import {
  MemberRole,
  Prisma,
  Project,
  ProjectMember,
  ProjectSettings,
  ProjectStatus,
  ProjectTag,
  ProjectVisibility,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ProjectQueryDto, ProjectStatsDto } from '../types/project.types';

export type ProjectWithRelations = Project & {
  tags: ProjectTag[];
  members: ProjectMember[];
  settings: ProjectSettings | null;
};

export interface FindAllResult {
  projects: ProjectWithRelations[];
  total: number;
}

export interface IProjectRepository {
  findById(id: string): Promise<ProjectWithRelations | null>;
  findBySlug(slug: string): Promise<ProjectWithRelations | null>;
  findByOwner(ownerId: string, query: ProjectQueryDto): Promise<FindAllResult>;
  findByMember(userId: string, query: ProjectQueryDto): Promise<FindAllResult>;
  findAll(query: ProjectQueryDto, userId?: string): Promise<FindAllResult>;
  create(data: Prisma.ProjectCreateInput, settings?: Partial<Prisma.ProjectSettingsCreateInput>): Promise<ProjectWithRelations>;
  update(id: string, data: Prisma.ProjectUpdateInput): Promise<ProjectWithRelations>;
  softDelete(id: string): Promise<ProjectWithRelations>;
  getStats(id: string): Promise<ProjectStatsDto>;
  slugExists(slug: string, excludeId?: string): Promise<boolean>;
}

export class ProjectRepository implements IProjectRepository {
  private readonly include: Prisma.ProjectInclude = {
    tags: true,
    members: true,
    settings: true,
  };

  async findById(id: string): Promise<ProjectWithRelations | null> {
    return prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: this.include,
    });
  }

  async findBySlug(slug: string): Promise<ProjectWithRelations | null> {
    return prisma.project.findFirst({
      where: { slug, deletedAt: null },
      include: this.include,
    });
  }

  async findByOwner(ownerId: string, query: ProjectQueryDto): Promise<FindAllResult> {
    const where = this.buildWhereClause(query, { ownerId });

    return this.paginateProjects(where, query);
  }

  async findByMember(userId: string, query: ProjectQueryDto): Promise<FindAllResult> {
    const where = this.buildWhereClause(query, {
      members: { some: { userId } },
    });

    return this.paginateProjects(where, query);
  }

  async findAll(query: ProjectQueryDto, userId?: string): Promise<FindAllResult> {
    const memberOrOwnerFilter =
      userId !== undefined
        ? {
            OR: [
              { ownerId: userId },
              { members: { some: { userId } } },
              { visibility: ProjectVisibility.PUBLIC },
            ],
          }
        : { visibility: ProjectVisibility.PUBLIC };

    const where = this.buildWhereClause(query, memberOrOwnerFilter);

    return this.paginateProjects(where, query);
  }

  async create(
    data: Prisma.ProjectCreateInput,
    settings?: Partial<Prisma.ProjectSettingsCreateInput>,
  ): Promise<ProjectWithRelations> {
    return prisma.project.create({
      data: {
        ...data,
        settings: {
          create: {
            defaultDocumentStatus: settings?.defaultDocumentStatus ?? 'DRAFT',
            allowPublicComments: settings?.allowPublicComments ?? false,
            enableVersioning: settings?.enableVersioning ?? true,
            autoSaveInterval: settings?.autoSaveInterval ?? 30,
          },
        },
      },
      include: this.include,
    });
  }

  async update(id: string, data: Prisma.ProjectUpdateInput): Promise<ProjectWithRelations> {
    return prisma.project.update({
      where: { id },
      data,
      include: this.include,
    });
  }

  async softDelete(id: string): Promise<ProjectWithRelations> {
    return prisma.project.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: ProjectStatus.DELETED,
      },
      include: this.include,
    });
  }

  async getStats(id: string): Promise<ProjectStatsDto> {
    const project = await prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        members: true,
        tags: true,
        settings: true,
      },
    });

    if (project === null) {
      throw new Error(`Project ${id} not found`);
    }

    const membersByRole = project.members.reduce(
      (acc, member) => {
        acc[member.role] = (acc[member.role] ?? 0) + 1;

        return acc;
      },
      {} as Record<MemberRole, number>,
    );

    return {
      projectId: id,
      totalMembers: project.members.length,
      membersByRole,
      totalTags: project.tags.length,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const count = await prisma.project.count({
      where: {
        slug,
        deletedAt: null,
        ...(excludeId !== undefined ? { NOT: { id: excludeId } } : {}),
      },
    });

    return count > 0;
  }

  private buildWhereClause(
    query: ProjectQueryDto,
    extra: Prisma.ProjectWhereInput = {},
  ): Prisma.ProjectWhereInput {
    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
      ...extra,
    };

    if (query.search !== undefined && query.search !== '') {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.status !== undefined) {
      where.status = query.status;
    } else {
      where.status = { not: ProjectStatus.DELETED };
    }

    if (query.visibility !== undefined) {
      where.visibility = query.visibility;
    }

    if (query.organizationId !== undefined) {
      where.organizationId = query.organizationId;
    }

    if (query.tags !== undefined && query.tags.length > 0) {
      where.tags = { some: { name: { in: query.tags } } };
    }

    return where;
  }

  private async paginateProjects(
    where: Prisma.ProjectWhereInput,
    query: ProjectQueryDto,
  ): Promise<FindAllResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const [projects, total] = await prisma.$transaction([
      prisma.project.findMany({
        where,
        include: this.include,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.project.count({ where }),
    ]);

    return { projects, total };
  }
}
