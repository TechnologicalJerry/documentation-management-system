import { MemberRole, ProjectInvitation, ProjectMember } from '@prisma/client';
import crypto from 'crypto';
import { config } from '../config';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../lib/errors';
import { logger } from '../lib/logger';
import { ProjectRepository } from '../repositories/project.repository';
import {
  IProjectMemberRepository,
  ProjectMemberRepository,
} from '../repositories/projectMember.repository';
import {
  AcceptInvitationDto,
  AddMemberDto,
  InviteMemberDto,
  InvitationResponseDto,
  ProjectMemberResponseDto,
  UpdateMemberDto,
} from '../types/project.types';
import { ProjectPublisher } from '../events/project.publisher';

// Role hierarchy: higher index = more permissions
const ROLE_HIERARCHY: MemberRole[] = [
  MemberRole.VIEWER,
  MemberRole.EDITOR,
  MemberRole.ADMIN,
  MemberRole.OWNER,
];

export interface IProjectMemberService {
  addMember(projectId: string, actorId: string, dto: AddMemberDto): Promise<ProjectMemberResponseDto>;
  removeMember(projectId: string, actorId: string, targetUserId: string): Promise<void>;
  updateRole(projectId: string, actorId: string, targetUserId: string, dto: UpdateMemberDto): Promise<ProjectMemberResponseDto>;
  getMembers(projectId: string): Promise<ProjectMemberResponseDto[]>;
  inviteMember(projectId: string, actorId: string, dto: InviteMemberDto): Promise<InvitationResponseDto>;
  acceptInvitation(dto: AcceptInvitationDto): Promise<ProjectMemberResponseDto>;
  checkAccess(projectId: string, userId: string, requiredRole: MemberRole): Promise<boolean>;
  getProjectsForUser(userId: string): Promise<string[]>;
}

export class ProjectMemberService implements IProjectMemberService {
  private readonly memberRepo: IProjectMemberRepository;
  private readonly projectRepo: ProjectRepository;
  private readonly publisher: ProjectPublisher;

  constructor(
    memberRepo?: IProjectMemberRepository,
    projectRepo?: ProjectRepository,
    publisher?: ProjectPublisher,
  ) {
    this.memberRepo = memberRepo ?? new ProjectMemberRepository();
    this.projectRepo = projectRepo ?? new ProjectRepository();
    this.publisher = publisher ?? new ProjectPublisher();
  }

  async addMember(
    projectId: string,
    actorId: string,
    dto: AddMemberDto,
  ): Promise<ProjectMemberResponseDto> {
    const project = await this.projectRepo.findById(projectId);
    if (project === null) {
      throw new NotFoundError('Project');
    }

    // Only owners/admins can add members
    await this.assertHasRole(projectId, actorId, MemberRole.ADMIN, project.ownerId);

    const existing = await this.memberRepo.findMember(projectId, dto.userId);
    if (existing !== null) {
      throw new ConflictError('User is already a member of this project');
    }

    // Prevent assigning OWNER role via this method
    if (dto.role === MemberRole.OWNER) {
      throw new BadRequestError('Cannot assign OWNER role directly');
    }

    const member = await this.memberRepo.addMember(projectId, dto.userId, dto.role);

    await this.publisher
      .publishMemberAdded(projectId, dto.userId, dto.role, actorId)
      .catch((err) => {
        logger.warn('Failed to publish MemberAdded event', { error: err });
      });

    logger.info('Member added to project', { projectId, userId: dto.userId, role: dto.role });

    return this.mapMemberToResponse(member);
  }

  async removeMember(
    projectId: string,
    actorId: string,
    targetUserId: string,
  ): Promise<void> {
    const project = await this.projectRepo.findById(projectId);
    if (project === null) {
      throw new NotFoundError('Project');
    }

    // Cannot remove project owner
    if (targetUserId === project.ownerId) {
      throw new ForbiddenError('Cannot remove the project owner');
    }

    // Members can remove themselves; admins/owners can remove others
    if (actorId !== targetUserId) {
      await this.assertHasRole(projectId, actorId, MemberRole.ADMIN, project.ownerId);
    }

    const member = await this.memberRepo.findMember(projectId, targetUserId);
    if (member === null) {
      throw new NotFoundError('Member');
    }

    await this.memberRepo.removeMember(projectId, targetUserId);

    await this.publisher.publishMemberRemoved(projectId, targetUserId, actorId).catch((err) => {
      logger.warn('Failed to publish MemberRemoved event', { error: err });
    });

    logger.info('Member removed from project', { projectId, userId: targetUserId });
  }

  async updateRole(
    projectId: string,
    actorId: string,
    targetUserId: string,
    dto: UpdateMemberDto,
  ): Promise<ProjectMemberResponseDto> {
    const project = await this.projectRepo.findById(projectId);
    if (project === null) {
      throw new NotFoundError('Project');
    }

    // Cannot change owner's role
    if (targetUserId === project.ownerId) {
      throw new ForbiddenError('Cannot change the role of the project owner');
    }

    // Cannot assign OWNER role
    if (dto.role === MemberRole.OWNER) {
      throw new BadRequestError('Cannot assign OWNER role');
    }

    await this.assertHasRole(projectId, actorId, MemberRole.ADMIN, project.ownerId);

    const member = await this.memberRepo.findMember(projectId, targetUserId);
    if (member === null) {
      throw new NotFoundError('Member');
    }

    const oldRole = member.role;
    const updated = await this.memberRepo.updateMemberRole(projectId, targetUserId, dto.role);

    await this.publisher
      .publishMemberRoleChanged(projectId, targetUserId, oldRole, dto.role, actorId)
      .catch((err) => {
        logger.warn('Failed to publish MemberRoleChanged event', { error: err });
      });

    logger.info('Member role updated', {
      projectId,
      userId: targetUserId,
      oldRole,
      newRole: dto.role,
    });

    return this.mapMemberToResponse(updated);
  }

  async getMembers(projectId: string): Promise<ProjectMemberResponseDto[]> {
    const project = await this.projectRepo.findById(projectId);
    if (project === null) {
      throw new NotFoundError('Project');
    }

    const members = await this.memberRepo.findByProject(projectId);

    return members.map((m) => this.mapMemberToResponse(m));
  }

  async inviteMember(
    projectId: string,
    actorId: string,
    dto: InviteMemberDto,
  ): Promise<InvitationResponseDto> {
    const project = await this.projectRepo.findById(projectId);
    if (project === null) {
      throw new NotFoundError('Project');
    }

    await this.assertHasRole(projectId, actorId, MemberRole.ADMIN, project.ownerId);

    // Check for pending invitation
    const existing = await this.memberRepo.findPendingInvitationByEmail(projectId, dto.email);
    if (existing !== null) {
      throw new ConflictError('A pending invitation already exists for this email');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + config.invitation.expiryHours);

    const invitation = await this.memberRepo.createInvitation({
      projectId,
      email: dto.email,
      role: dto.role,
      token,
      invitedBy: actorId,
      expiresAt,
    });

    await this.publisher
      .publishInvitationSent(projectId, dto.email, token, actorId)
      .catch((err) => {
        logger.warn('Failed to publish InvitationSent event', { error: err });
      });

    logger.info('Invitation sent', { projectId, email: dto.email, invitedBy: actorId });

    return this.mapInvitationToResponse(invitation);
  }

  async acceptInvitation(dto: AcceptInvitationDto): Promise<ProjectMemberResponseDto> {
    const invitation = await this.memberRepo.findInvitationByToken(dto.token);
    if (invitation === null) {
      throw new NotFoundError('Invitation');
    }

    if (invitation.acceptedAt !== null) {
      throw new ConflictError('Invitation has already been accepted');
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestError('Invitation has expired');
    }

    // Check if user is already a member
    const existing = await this.memberRepo.findMember(invitation.projectId, dto.userId);
    if (existing !== null) {
      throw new ConflictError('User is already a member of this project');
    }

    const [member] = await Promise.all([
      this.memberRepo.addMember(invitation.projectId, dto.userId, invitation.role),
      this.memberRepo.acceptInvitation(dto.token),
    ]);

    await this.publisher
      .publishInvitationAccepted(invitation.projectId, dto.userId, invitation.invitedBy)
      .catch((err) => {
        logger.warn('Failed to publish InvitationAccepted event', { error: err });
      });

    logger.info('Invitation accepted', {
      projectId: invitation.projectId,
      userId: dto.userId,
      token: dto.token,
    });

    return this.mapMemberToResponse(member);
  }

  async checkAccess(
    projectId: string,
    userId: string,
    requiredRole: MemberRole,
  ): Promise<boolean> {
    const project = await this.projectRepo.findById(projectId);
    if (project === null) {
      return false;
    }

    if (project.ownerId === userId) {
      return true;
    }

    const role = await this.memberRepo.getMemberRole(projectId, userId);
    if (role === null) {
      return false;
    }

    return this.roleHasPermission(role, requiredRole);
  }

  async getProjectsForUser(userId: string): Promise<string[]> {
    const memberships = await this.memberRepo.findByUser(userId);

    return memberships.map((m) => m.projectId);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private roleHasPermission(userRole: MemberRole, requiredRole: MemberRole): boolean {
    const userLevel = ROLE_HIERARCHY.indexOf(userRole);
    const requiredLevel = ROLE_HIERARCHY.indexOf(requiredRole);

    return userLevel >= requiredLevel;
  }

  private async assertHasRole(
    projectId: string,
    userId: string,
    requiredRole: MemberRole,
    ownerId: string,
  ): Promise<void> {
    if (userId === ownerId) {
      return;
    }

    const role = await this.memberRepo.getMemberRole(projectId, userId);
    if (role === null || !this.roleHasPermission(role, requiredRole)) {
      throw new ForbiddenError('Insufficient permissions for this action');
    }
  }

  private mapMemberToResponse(member: ProjectMember): ProjectMemberResponseDto {
    return {
      id: member.id,
      userId: member.userId,
      role: member.role,
      joinedAt: member.joinedAt,
      updatedAt: member.updatedAt,
    };
  }

  private mapInvitationToResponse(invitation: ProjectInvitation): InvitationResponseDto {
    return {
      id: invitation.id,
      projectId: invitation.projectId,
      email: invitation.email,
      role: invitation.role,
      token: invitation.token,
      invitedBy: invitation.invitedBy,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      createdAt: invitation.createdAt,
    };
  }
}
