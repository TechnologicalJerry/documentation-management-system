import { ITeamRepository, TeamRepository } from '../repositories/team.repository';
import {
  IOrganizationRepository,
  OrganizationRepository,
} from '../repositories/organization.repository';
import { IUserRepository, UserRepository } from '../repositories/user.repository';
import {
  CreateTeamDto,
  UpdateTeamDto,
  TeamQueryDto,
  TeamResponseDto,
  TeamMemberResponseDto,
  PaginatedResponse,
  TeamMemberRole,
  AddTeamMemberDto,
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../types/user.types';
import { logger } from '../utils/logger';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface ITeamService {
  createTeam(dto: CreateTeamDto): Promise<TeamResponseDto>;
  getTeam(id: string): Promise<TeamResponseDto>;
  getTeamsByOrganization(
    organizationId: string,
    query: TeamQueryDto,
  ): Promise<PaginatedResponse<TeamResponseDto>>;
  updateTeam(id: string, dto: UpdateTeamDto): Promise<TeamResponseDto>;
  deleteTeam(id: string): Promise<void>;
  addMember(teamId: string, dto: AddTeamMemberDto): Promise<TeamMemberResponseDto>;
  removeMember(teamId: string, userId: string): Promise<void>;
  updateMemberRole(teamId: string, userId: string, role: TeamMemberRole): Promise<TeamMemberResponseDto>;
  getTeamMembers(
    teamId: string,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResponse<TeamMemberResponseDto>>;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class TeamService implements ITeamService {
  private readonly teamRepository: ITeamRepository;
  private readonly orgRepository: IOrganizationRepository;
  private readonly userRepository: IUserRepository;

  constructor(
    teamRepository?: ITeamRepository,
    orgRepository?: IOrganizationRepository,
    userRepository?: IUserRepository,
  ) {
    this.teamRepository = teamRepository ?? new TeamRepository();
    this.orgRepository = orgRepository ?? new OrganizationRepository();
    this.userRepository = userRepository ?? new UserRepository();
  }

  async createTeam(dto: CreateTeamDto): Promise<TeamResponseDto> {
    if (!dto.name || dto.name.trim().length === 0) {
      throw new ValidationError('Team name is required');
    }

    // Verify organization exists
    const org = await this.orgRepository.findById(dto.organizationId);
    if (!org) {
      throw new NotFoundError('Organization', dto.organizationId);
    }

    const team = await this.teamRepository.create({
      ...dto,
      name: dto.name.trim(),
    });

    logger.info('Team created', { teamId: team.id, orgId: dto.organizationId });

    return team;
  }

  async getTeam(id: string): Promise<TeamResponseDto> {
    const team = await this.teamRepository.findById(id);
    if (!team) {
      throw new NotFoundError('Team', id);
    }

    return team;
  }

  async getTeamsByOrganization(
    organizationId: string,
    query: TeamQueryDto,
  ): Promise<PaginatedResponse<TeamResponseDto>> {
    const org = await this.orgRepository.findById(organizationId);
    if (!org) {
      throw new NotFoundError('Organization', organizationId);
    }

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    return this.teamRepository.findByOrganization(organizationId, { ...query, page, limit });
  }

  async updateTeam(id: string, dto: UpdateTeamDto): Promise<TeamResponseDto> {
    const existing = await this.teamRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Team', id);
    }

    if (dto.name !== undefined && dto.name.trim().length === 0) {
      throw new ValidationError('Team name cannot be empty');
    }

    const updated = await this.teamRepository.update(id, {
      ...dto,
      name: dto.name?.trim(),
    });

    logger.info('Team updated', { teamId: id });

    return updated;
  }

  async deleteTeam(id: string): Promise<void> {
    const existing = await this.teamRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Team', id);
    }

    await this.teamRepository.delete(id);
    logger.info('Team deleted', { teamId: id });
  }

  async addMember(teamId: string, dto: AddTeamMemberDto): Promise<TeamMemberResponseDto> {
    const [team, user] = await Promise.all([
      this.teamRepository.findById(teamId),
      this.userRepository.findById(dto.userId),
    ]);

    if (!team) {throw new NotFoundError('Team', teamId);}
    if (!user) {throw new NotFoundError('User', dto.userId);}

    // Check if user belongs to the same organization
    if (user.organizationId && user.organizationId !== team.organizationId) {
      throw new ConflictError('User does not belong to the team\'s organization');
    }

    // Check if already a member
    const alreadyMember = await this.teamRepository.isMember(teamId, dto.userId);
    if (alreadyMember) {
      throw new ConflictError('User is already a member of this team');
    }

    const role = dto.role ?? TeamMemberRole.MEMBER;
    const member = await this.teamRepository.addMember(teamId, dto.userId, role);

    logger.info('Team member added', { teamId, userId: dto.userId, role });

    return member;
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    const [team, isMember] = await Promise.all([
      this.teamRepository.findById(teamId),
      this.teamRepository.isMember(teamId, userId),
    ]);

    if (!team) {throw new NotFoundError('Team', teamId);}
    if (!isMember) {throw new NotFoundError('Team member');}

    await this.teamRepository.removeMember(teamId, userId);
    logger.info('Team member removed', { teamId, userId });
  }

  async updateMemberRole(
    teamId: string,
    userId: string,
    role: TeamMemberRole,
  ): Promise<TeamMemberResponseDto> {
    const [team, isMember] = await Promise.all([
      this.teamRepository.findById(teamId),
      this.teamRepository.isMember(teamId, userId),
    ]);

    if (!team) {throw new NotFoundError('Team', teamId);}
    if (!isMember) {throw new NotFoundError('Team member');}

    const member = await this.teamRepository.updateMemberRole(teamId, userId, role);
    logger.info('Team member role updated', { teamId, userId, role });

    return member;
  }

  async getTeamMembers(
    teamId: string,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResponse<TeamMemberResponseDto>> {
    const team = await this.teamRepository.findById(teamId);
    if (!team) {
      throw new NotFoundError('Team', teamId);
    }

    const page = Math.max(1, pagination.page);
    const limit = Math.min(100, Math.max(1, pagination.limit));

    return this.teamRepository.getMembers(teamId, { page, limit });
  }
}
