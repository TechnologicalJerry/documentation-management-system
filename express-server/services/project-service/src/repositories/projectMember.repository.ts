import { MemberRole, Prisma, ProjectInvitation, ProjectMember } from '@prisma/client';
import { prisma } from '../lib/prisma';

export interface IProjectMemberRepository {
  findByProject(projectId: string): Promise<ProjectMember[]>;
  findByUser(userId: string): Promise<ProjectMember[]>;
  findMember(projectId: string, userId: string): Promise<ProjectMember | null>;
  addMember(projectId: string, userId: string, role: MemberRole): Promise<ProjectMember>;
  updateMemberRole(projectId: string, userId: string, role: MemberRole): Promise<ProjectMember>;
  removeMember(projectId: string, userId: string): Promise<ProjectMember>;
  isMember(projectId: string, userId: string): Promise<boolean>;
  getMemberRole(projectId: string, userId: string): Promise<MemberRole | null>;
  countByProject(projectId: string): Promise<number>;

  // Invitation methods
  createInvitation(data: Prisma.ProjectInvitationCreateInput): Promise<ProjectInvitation>;
  findInvitationByToken(token: string): Promise<ProjectInvitation | null>;
  findInvitationsByProject(projectId: string): Promise<ProjectInvitation[]>;
  findPendingInvitationByEmail(projectId: string, email: string): Promise<ProjectInvitation | null>;
  acceptInvitation(token: string): Promise<ProjectInvitation>;
  deleteExpiredInvitations(): Promise<number>;
}

export class ProjectMemberRepository implements IProjectMemberRepository {
  async findByProject(projectId: string): Promise<ProjectMember[]> {
    return prisma.projectMember.findMany({
      where: { projectId },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async findByUser(userId: string): Promise<ProjectMember[]> {
    return prisma.projectMember.findMany({
      where: { userId },
      orderBy: { joinedAt: 'desc' },
    });
  }

  async findMember(projectId: string, userId: string): Promise<ProjectMember | null> {
    return prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
  }

  async addMember(projectId: string, userId: string, role: MemberRole): Promise<ProjectMember> {
    return prisma.projectMember.create({
      data: { projectId, userId, role },
    });
  }

  async updateMemberRole(
    projectId: string,
    userId: string,
    role: MemberRole,
  ): Promise<ProjectMember> {
    return prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId } },
      data: { role },
    });
  }

  async removeMember(projectId: string, userId: string): Promise<ProjectMember> {
    return prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  }

  async isMember(projectId: string, userId: string): Promise<boolean> {
    const count = await prisma.projectMember.count({
      where: { projectId, userId },
    });

    return count > 0;
  }

  async getMemberRole(projectId: string, userId: string): Promise<MemberRole | null> {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: true },
    });

    return member?.role ?? null;
  }

  async countByProject(projectId: string): Promise<number> {
    return prisma.projectMember.count({ where: { projectId } });
  }

  // ─── Invitation methods ────────────────────────────────────────────────────

  async createInvitation(data: Prisma.ProjectInvitationCreateInput): Promise<ProjectInvitation> {
    return prisma.projectInvitation.create({ data });
  }

  async findInvitationByToken(token: string): Promise<ProjectInvitation | null> {
    return prisma.projectInvitation.findUnique({ where: { token } });
  }

  async findInvitationsByProject(projectId: string): Promise<ProjectInvitation[]> {
    return prisma.projectInvitation.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPendingInvitationByEmail(
    projectId: string,
    email: string,
  ): Promise<ProjectInvitation | null> {
    return prisma.projectInvitation.findFirst({
      where: {
        projectId,
        email,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async acceptInvitation(token: string): Promise<ProjectInvitation> {
    return prisma.projectInvitation.update({
      where: { token },
      data: { acceptedAt: new Date() },
    });
  }

  async deleteExpiredInvitations(): Promise<number> {
    const result = await prisma.projectInvitation.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        acceptedAt: null,
      },
    });

    return result.count;
  }
}
