import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  CreateTeamDto,
  UpdateTeamDto,
  TeamQueryDto,
  TeamResponseDto,
  TeamMemberResponseDto,
  PaginatedResponse,
  TeamMemberRole,
} from '../types/user.types';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface ITeamRepository {
  findById(id: string): Promise<TeamResponseDto | null>;
  findByOrganization(
    organizationId: string,
    query: TeamQueryDto,
  ): Promise<PaginatedResponse<TeamResponseDto>>;
  create(dto: CreateTeamDto): Promise<TeamResponseDto>;
  update(id: string, dto: UpdateTeamDto): Promise<TeamResponseDto>;
  delete(id: string): Promise<void>;
  addMember(teamId: string, userId: string, role: TeamMemberRole): Promise<TeamMemberResponseDto>;
  removeMember(teamId: string, userId: string): Promise<void>;
  updateMemberRole(teamId: string, userId: string, role: TeamMemberRole): Promise<TeamMemberResponseDto>;
  getMembers(
    teamId: string,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResponse<TeamMemberResponseDto>>;
  isMember(teamId: string, userId: string): Promise<boolean>;
}

// ─── Include Helpers ──────────────────────────────────────────────────────────

const teamMemberInclude = {
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      displayName: true,
      avatar: true,
    },
  },
} satisfies Prisma.TeamMemberInclude;

// ─── Implementation ───────────────────────────────────────────────────────────

export class TeamRepository implements ITeamRepository {
  async findById(id: string): Promise<TeamResponseDto | null> {
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        _count: { select: { members: true } },
      },
    });

    if (!team) {return null;}

    return {
      id: team.id,
      name: team.name,
      description: team.description,
      organizationId: team.organizationId,
      memberCount: team._count.members,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };
  }

  async findByOrganization(
    organizationId: string,
    query: TeamQueryDto,
  ): Promise<PaginatedResponse<TeamResponseDto>> {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.TeamWhereInput = {
      organizationId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [teams, total] = await Promise.all([
      prisma.team.findMany({
        where,
        include: { _count: { select: { members: true } } },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.team.count({ where }),
    ]);

    return {
      data: teams.map((team) => ({
        id: team.id,
        name: team.name,
        description: team.description,
        organizationId: team.organizationId,
        memberCount: team._count.members,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(dto: CreateTeamDto): Promise<TeamResponseDto> {
    const team = await prisma.team.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        organizationId: dto.organizationId,
      },
      include: { _count: { select: { members: true } } },
    });

    return {
      id: team.id,
      name: team.name,
      description: team.description,
      organizationId: team.organizationId,
      memberCount: team._count.members,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };
  }

  async update(id: string, dto: UpdateTeamDto): Promise<TeamResponseDto> {
    const updateData: Prisma.TeamUpdateInput = {};

    if (dto.name !== undefined) {updateData.name = dto.name;}
    if (dto.description !== undefined) {updateData.description = dto.description;}

    const team = await prisma.team.update({
      where: { id },
      data: updateData,
      include: { _count: { select: { members: true } } },
    });

    return {
      id: team.id,
      name: team.name,
      description: team.description,
      organizationId: team.organizationId,
      memberCount: team._count.members,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };
  }

  async delete(id: string): Promise<void> {
    // Remove all members first, then delete the team
    await prisma.$transaction([
      prisma.teamMember.deleteMany({ where: { teamId: id } }),
      prisma.team.delete({ where: { id } }),
    ]);
  }

  async addMember(
    teamId: string,
    userId: string,
    role: TeamMemberRole,
  ): Promise<TeamMemberResponseDto> {
    const member = await prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role,
      },
      include: teamMemberInclude,
    });

    return member as TeamMemberResponseDto;
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    await prisma.teamMember.delete({
      where: { userId_teamId: { userId, teamId } },
    });
  }

  async updateMemberRole(
    teamId: string,
    userId: string,
    role: TeamMemberRole,
  ): Promise<TeamMemberResponseDto> {
    const member = await prisma.teamMember.update({
      where: { userId_teamId: { userId, teamId } },
      data: { role },
      include: teamMemberInclude,
    });

    return member as TeamMemberResponseDto;
  }

  async getMembers(
    teamId: string,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResponse<TeamMemberResponseDto>> {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.TeamMemberWhereInput = { teamId };

    const [members, total] = await Promise.all([
      prisma.teamMember.findMany({
        where,
        include: teamMemberInclude,
        orderBy: { joinedAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.teamMember.count({ where }),
    ]);

    return {
      data: members as TeamMemberResponseDto[],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async isMember(teamId: string, userId: string): Promise<boolean> {
    const count = await prisma.teamMember.count({
      where: { teamId, userId },
    });

    return count > 0;
  }
}
