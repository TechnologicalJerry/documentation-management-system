import {
  IOrganizationRepository,
  OrganizationRepository,
} from '../repositories/organization.repository';
import { IUserRepository, UserRepository } from '../repositories/user.repository';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  OrganizationQueryDto,
  OrganizationResponseDto,
  PaginatedResponse,
  UserSummaryDto,
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../types/user.types';
import { logger } from '../utils/logger';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IOrganizationService {
  createOrganization(dto: CreateOrganizationDto): Promise<OrganizationResponseDto>;
  getOrganization(id: string): Promise<OrganizationResponseDto>;
  getOrganizationBySlug(slug: string): Promise<OrganizationResponseDto>;
  getOrganizations(query: OrganizationQueryDto): Promise<PaginatedResponse<OrganizationResponseDto>>;
  updateOrganization(id: string, dto: UpdateOrganizationDto): Promise<OrganizationResponseDto>;
  deleteOrganization(id: string): Promise<void>;
  getMembers(
    orgId: string,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResponse<UserSummaryDto>>;
  inviteMember(orgId: string, userId: string): Promise<void>;
  removeMember(orgId: string, userId: string): Promise<void>;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class OrganizationService implements IOrganizationService {
  private readonly orgRepository: IOrganizationRepository;
  private readonly userRepository: IUserRepository;

  constructor(
    orgRepository?: IOrganizationRepository,
    userRepository?: IUserRepository,
  ) {
    this.orgRepository = orgRepository ?? new OrganizationRepository();
    this.userRepository = userRepository ?? new UserRepository();
  }

  async createOrganization(dto: CreateOrganizationDto): Promise<OrganizationResponseDto> {
    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(dto.slug)) {
      throw new ValidationError(
        'Slug must contain only lowercase letters, numbers, and hyphens',
      );
    }

    // Check slug uniqueness
    const existing = await this.orgRepository.findBySlug(dto.slug);
    if (existing) {
      throw new ConflictError(`Organization with slug '${dto.slug}' already exists`);
    }

    const org = await this.orgRepository.create(dto);
    logger.info('Organization created', { orgId: org.id, slug: org.slug });

    return org;
  }

  async getOrganization(id: string): Promise<OrganizationResponseDto> {
    const org = await this.orgRepository.findById(id);
    if (!org) {
      throw new NotFoundError('Organization', id);
    }

    return org;
  }

  async getOrganizationBySlug(slug: string): Promise<OrganizationResponseDto> {
    const org = await this.orgRepository.findBySlug(slug);
    if (!org) {
      throw new NotFoundError('Organization');
    }

    return org;
  }

  async getOrganizations(
    query: OrganizationQueryDto,
  ): Promise<PaginatedResponse<OrganizationResponseDto>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    return this.orgRepository.findAll({ ...query, page, limit });
  }

  async updateOrganization(
    id: string,
    dto: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    const existing = await this.orgRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Organization', id);
    }

    const updated = await this.orgRepository.update(id, dto);
    logger.info('Organization updated', { orgId: id });

    return updated;
  }

  async deleteOrganization(id: string): Promise<void> {
    const existing = await this.orgRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Organization', id);
    }

    // Check if there are active members
    const memberCount = await this.orgRepository.getMemberCount(id);
    if (memberCount > 0) {
      throw new ConflictError(
        `Cannot delete organization with ${memberCount} active member(s). Remove all members first.`,
      );
    }

    await this.orgRepository.delete(id);
    logger.info('Organization deleted', { orgId: id });
  }

  async getMembers(
    orgId: string,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResponse<UserSummaryDto>> {
    const org = await this.orgRepository.findById(orgId);
    if (!org) {
      throw new NotFoundError('Organization', orgId);
    }

    const page = Math.max(1, pagination.page);
    const limit = Math.min(100, Math.max(1, pagination.limit));

    return this.orgRepository.getMembers(orgId, { page, limit });
  }

  async inviteMember(orgId: string, userId: string): Promise<void> {
    const [org, user] = await Promise.all([
      this.orgRepository.findById(orgId),
      this.userRepository.findById(userId),
    ]);

    if (!org) {throw new NotFoundError('Organization', orgId);}
    if (!user) {throw new NotFoundError('User', userId);}

    // Check member cap
    const memberCount = await this.orgRepository.getMemberCount(orgId);
    if (memberCount >= org.maxMembers) {
      throw new ConflictError(
        `Organization has reached its member limit of ${org.maxMembers}. Upgrade your plan to add more members.`,
      );
    }

    // Check if already a member
    if (user.organizationId === orgId) {
      throw new ConflictError('User is already a member of this organization');
    }

    await this.userRepository.update(userId, { organizationId: orgId });
    logger.info('Member invited to organization', { orgId, userId });
  }

  async removeMember(orgId: string, userId: string): Promise<void> {
    const [org, user] = await Promise.all([
      this.orgRepository.findById(orgId),
      this.userRepository.findById(userId),
    ]);

    if (!org) {throw new NotFoundError('Organization', orgId);}
    if (!user) {throw new NotFoundError('User', userId);}

    if (user.organizationId !== orgId) {
      throw new ConflictError('User is not a member of this organization');
    }

    await this.userRepository.update(userId, { organizationId: null });
    logger.info('Member removed from organization', { orgId, userId });
  }
}
