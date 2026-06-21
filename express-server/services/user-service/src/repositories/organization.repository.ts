import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  OrganizationQueryDto,
  OrganizationResponseDto,
  PaginatedResponse,
  UserSummaryDto,
} from '../types/user.types';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IOrganizationRepository {
  findById(id: string, includeDeleted?: boolean): Promise<OrganizationResponseDto | null>;
  findBySlug(slug: string): Promise<OrganizationResponseDto | null>;
  findAll(query: OrganizationQueryDto): Promise<PaginatedResponse<OrganizationResponseDto>>;
  create(dto: CreateOrganizationDto): Promise<OrganizationResponseDto>;
  update(id: string, dto: UpdateOrganizationDto): Promise<OrganizationResponseDto>;
  delete(id: string): Promise<void>;
  getMembers(id: string, pagination: { page: number; limit: number }): Promise<PaginatedResponse<UserSummaryDto>>;
  getMemberCount(id: string): Promise<number>;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class OrganizationRepository implements IOrganizationRepository {
  async findById(id: string, includeDeleted = false): Promise<OrganizationResponseDto | null> {
    const org = await prisma.organization.findFirst({
      where: {
        id,
        ...(!includeDeleted && { deletedAt: null }),
      },
      include: {
        _count: { select: { users: true } },
      },
    });

    if (!org) {return null;}

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      description: org.description,
      logo: org.logo,
      website: org.website,
      plan: org.plan,
      maxMembers: org.maxMembers,
      isActive: org.isActive,
      memberCount: org._count.users,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }

  async findBySlug(slug: string): Promise<OrganizationResponseDto | null> {
    const org = await prisma.organization.findFirst({
      where: { slug, deletedAt: null },
      include: {
        _count: { select: { users: true } },
      },
    });

    if (!org) {return null;}

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      description: org.description,
      logo: org.logo,
      website: org.website,
      plan: org.plan,
      maxMembers: org.maxMembers,
      isActive: org.isActive,
      memberCount: org._count.users,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }

  async findAll(query: OrganizationQueryDto): Promise<PaginatedResponse<OrganizationResponseDto>> {
    const {
      page = 1,
      limit = 20,
      search,
      plan,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.OrganizationWhereInput = {
      deletedAt: null,
      ...(isActive !== undefined && { isActive }),
      ...((plan != null) && { plan }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [orgs, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        include: { _count: { select: { users: true } } },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.organization.count({ where }),
    ]);

    return {
      data: orgs.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        logo: org.logo,
        website: org.website,
        plan: org.plan,
        maxMembers: org.maxMembers,
        isActive: org.isActive,
        memberCount: org._count.users,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(dto: CreateOrganizationDto): Promise<OrganizationResponseDto> {
    const org = await prisma.organization.create({
      data: {
        name: dto.name,
        slug: dto.slug.toLowerCase(),
        description: dto.description ?? null,
        logo: dto.logo ?? null,
        website: dto.website ?? null,
        plan: dto.plan ?? 'free',
        maxMembers: dto.maxMembers ?? 5,
        isActive: true,
      },
      include: { _count: { select: { users: true } } },
    });

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      description: org.description,
      logo: org.logo,
      website: org.website,
      plan: org.plan,
      maxMembers: org.maxMembers,
      isActive: org.isActive,
      memberCount: org._count.users,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }

  async update(id: string, dto: UpdateOrganizationDto): Promise<OrganizationResponseDto> {
    const updateData: Prisma.OrganizationUpdateInput = {};

    if (dto.name !== undefined) {updateData.name = dto.name;}
    if (dto.description !== undefined) {updateData.description = dto.description;}
    if (dto.logo !== undefined) {updateData.logo = dto.logo;}
    if (dto.website !== undefined) {updateData.website = dto.website;}
    if (dto.plan !== undefined) {updateData.plan = dto.plan;}
    if (dto.maxMembers !== undefined) {updateData.maxMembers = dto.maxMembers;}
    if (dto.isActive !== undefined) {updateData.isActive = dto.isActive;}

    const org = await prisma.organization.update({
      where: { id },
      data: updateData,
      include: { _count: { select: { users: true } } },
    });

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      description: org.description,
      logo: org.logo,
      website: org.website,
      plan: org.plan,
      maxMembers: org.maxMembers,
      isActive: org.isActive,
      memberCount: org._count.users,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }

  async delete(id: string): Promise<void> {
    await prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async getMembers(
    id: string,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResponse<UserSummaryDto>> {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      organizationId: id,
      deletedAt: null,
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          displayName: true,
          avatar: true,
        },
        orderBy: { firstName: 'asc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMemberCount(id: string): Promise<number> {
    return prisma.user.count({
      where: { organizationId: id, deletedAt: null },
    });
  }
}
