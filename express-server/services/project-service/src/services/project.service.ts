import { MemberRole, ProjectStatus, ProjectVisibility } from '@prisma/client';
import slugify from 'slugify';
import { ConflictError, ForbiddenError, NotFoundError } from '../lib/errors';
import { logger } from '../lib/logger';
import {
  IProjectRepository,
  ProjectRepository,
  ProjectWithRelations,
} from '../repositories/project.repository';
import { IProjectMemberRepository, ProjectMemberRepository } from '../repositories/projectMember.repository';
import {
  CreateProjectDto,
  ProjectListResponseDto,
  ProjectQueryDto,
  ProjectResponseDto,
  ProjectStatsDto,
  UpdateProjectDto,
} from '../types/project.types';
import { ProjectPublisher } from '../events/project.publisher';

export interface IProjectService {
  createProject(userId: string, dto: CreateProjectDto): Promise<ProjectResponseDto>;
  getProject(id: string, userId?: string): Promise<ProjectResponseDto>;
  getProjectBySlug(slug: string, userId?: string): Promise<ProjectResponseDto>;
  getProjects(userId: string, query: ProjectQueryDto): Promise<ProjectListResponseDto>;
  updateProject(id: string, userId: string, dto: UpdateProjectDto): Promise<ProjectResponseDto>;
  deleteProject(id: string, userId: string): Promise<void>;
  archiveProject(id: string, userId: string): Promise<ProjectResponseDto>;
  restoreProject(id: string, userId: string): Promise<ProjectResponseDto>;
  getProjectStats(id: string): Promise<ProjectStatsDto>;
}

export class ProjectService implements IProjectService {
  private readonly projectRepo: IProjectRepository;
  private readonly memberRepo: IProjectMemberRepository;
  private readonly publisher: ProjectPublisher;

  constructor(
    projectRepo?: IProjectRepository,
    memberRepo?: IProjectMemberRepository,
    publisher?: ProjectPublisher,
  ) {
    this.projectRepo = projectRepo ?? new ProjectRepository();
    this.memberRepo = memberRepo ?? new ProjectMemberRepository();
    this.publisher = publisher ?? new ProjectPublisher();
  }

  async createProject(userId: string, dto: CreateProjectDto): Promise<ProjectResponseDto> {
    const slug = await this.generateUniqueSlug(dto.name);

    const project = await this.projectRepo.create(
      {
        name: dto.name,
        slug,
        description: dto.description,
        visibility: dto.visibility ?? ProjectVisibility.PRIVATE,
        organizationId: dto.organizationId,
        ownerId: userId,
        coverImage: dto.coverImage,
        tags: dto.tags?.length
          ? {
              create: dto.tags.map((tag) => ({
                name: tag.name,
                color: tag.color ?? '#6366f1',
              })),
            }
          : undefined,
        members: {
          create: {
            userId,
            role: MemberRole.OWNER,
          },
        },
      },
      dto.settings,
    );

    const response = this.mapToResponse(project);

    await this.publisher.publishProjectCreated(response, userId).catch((err) => {
      logger.warn('Failed to publish ProjectCreated event', { error: err });
    });

    logger.info('Project created', { projectId: project.id, ownerId: userId });

    return response;
  }

  async getProject(id: string, userId?: string): Promise<ProjectResponseDto> {
    const project = await this.projectRepo.findById(id);
    if (project === null) {
      throw new NotFoundError('Project');
    }

    this.assertCanView(project, userId);

    return this.mapToResponse(project);
  }

  async getProjectBySlug(slug: string, userId?: string): Promise<ProjectResponseDto> {
    const project = await this.projectRepo.findBySlug(slug);
    if (project === null) {
      throw new NotFoundError('Project');
    }

    this.assertCanView(project, userId);

    return this.mapToResponse(project);
  }

  async getProjects(userId: string, query: ProjectQueryDto): Promise<ProjectListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { projects, total } = await this.projectRepo.findAll(query, userId);

    return {
      projects: projects.map((p) => this.mapToResponse(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateProject(
    id: string,
    userId: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    const project = await this.projectRepo.findById(id);
    if (project === null) {
      throw new NotFoundError('Project');
    }

    await this.assertCanManage(project.id, userId, project.ownerId);

    const updateData: Parameters<IProjectRepository['update']>[1] = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
      // Only regenerate slug if name actually changed
      if (dto.name !== project.name) {
        updateData.slug = await this.generateUniqueSlug(dto.name, id);
      }
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }

    if (dto.visibility !== undefined) {
      updateData.visibility = dto.visibility;
    }

    if (dto.coverImage !== undefined) {
      updateData.coverImage = dto.coverImage;
    }

    // Replace tags entirely when provided
    if (dto.tags !== undefined) {
      updateData.tags = {
        deleteMany: {},
        create: dto.tags.map((tag) => ({
          name: tag.name,
          color: tag.color ?? '#6366f1',
        })),
      };
    }

    // Update nested settings
    if (dto.settings !== undefined) {
      updateData.settings = {
        upsert: {
          create: {
            defaultDocumentStatus: dto.settings.defaultDocumentStatus ?? 'DRAFT',
            allowPublicComments: dto.settings.allowPublicComments ?? false,
            enableVersioning: dto.settings.enableVersioning ?? true,
            autoSaveInterval: dto.settings.autoSaveInterval ?? 30,
          },
          update: {
            ...(dto.settings.defaultDocumentStatus !== undefined && {
              defaultDocumentStatus: dto.settings.defaultDocumentStatus,
            }),
            ...(dto.settings.allowPublicComments !== undefined && {
              allowPublicComments: dto.settings.allowPublicComments,
            }),
            ...(dto.settings.enableVersioning !== undefined && {
              enableVersioning: dto.settings.enableVersioning,
            }),
            ...(dto.settings.autoSaveInterval !== undefined && {
              autoSaveInterval: dto.settings.autoSaveInterval,
            }),
          },
        },
      };
    }

    const updated = await this.projectRepo.update(id, updateData);
    const response = this.mapToResponse(updated);

    await this.publisher.publishProjectUpdated(id, dto, userId).catch((err) => {
      logger.warn('Failed to publish ProjectUpdated event', { error: err });
    });

    logger.info('Project updated', { projectId: id, userId });

    return response;
  }

  async deleteProject(id: string, userId: string): Promise<void> {
    const project = await this.projectRepo.findById(id);
    if (project === null) {
      throw new NotFoundError('Project');
    }

    if (project.ownerId !== userId) {
      throw new ForbiddenError('Only the project owner can delete a project');
    }

    await this.projectRepo.softDelete(id);

    await this.publisher.publishProjectDeleted(id, userId).catch((err) => {
      logger.warn('Failed to publish ProjectDeleted event', { error: err });
    });

    logger.info('Project deleted', { projectId: id, userId });
  }

  async archiveProject(id: string, userId: string): Promise<ProjectResponseDto> {
    const project = await this.projectRepo.findById(id);
    if (project === null) {
      throw new NotFoundError('Project');
    }

    await this.assertCanManage(project.id, userId, project.ownerId);

    if (project.status === ProjectStatus.ARCHIVED) {
      throw new ConflictError('Project is already archived');
    }

    const updated = await this.projectRepo.update(id, { status: ProjectStatus.ARCHIVED });
    const response = this.mapToResponse(updated);

    await this.publisher
      .publishProjectUpdated(id, { visibility: project.visibility }, userId)
      .catch((err) => {
        logger.warn('Failed to publish project archived event', { error: err });
      });

    logger.info('Project archived', { projectId: id, userId });

    return response;
  }

  async restoreProject(id: string, userId: string): Promise<ProjectResponseDto> {
    const project = await this.projectRepo.findById(id);
    if (project === null) {
      throw new NotFoundError('Project');
    }

    await this.assertCanManage(project.id, userId, project.ownerId);

    if (project.status !== ProjectStatus.ARCHIVED) {
      throw new ConflictError('Only archived projects can be restored');
    }

    const updated = await this.projectRepo.update(id, { status: ProjectStatus.ACTIVE });

    logger.info('Project restored', { projectId: id, userId });

    return this.mapToResponse(updated);
  }

  async getProjectStats(id: string): Promise<ProjectStatsDto> {
    const project = await this.projectRepo.findById(id);
    if (project === null) {
      throw new NotFoundError('Project');
    }

    return this.projectRepo.getStats(id);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
    const baseSlug = slugify(name, { lower: true, strict: true, trim: true });
    let slug = baseSlug;
    let counter = 1;

    while (await this.projectRepo.slugExists(slug, excludeId)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  private assertCanView(project: ProjectWithRelations, userId?: string): void {
    if (project.visibility === ProjectVisibility.PUBLIC) {
      return;
    }

    if (userId === undefined) {
      throw new ForbiddenError('Authentication required to view this project');
    }

    if (project.ownerId === userId) {
      return;
    }

    const isMember = project.members.some((m) => m.userId === userId);
    if (!isMember && project.visibility !== ProjectVisibility.INTERNAL) {
      throw new ForbiddenError('You do not have access to this project');
    }
  }

  private async assertCanManage(
    projectId: string,
    userId: string,
    ownerId: string,
  ): Promise<void> {
    if (ownerId === userId) {
      return;
    }

    const role = await this.memberRepo.getMemberRole(projectId, userId);
    if (role === null || (role !== MemberRole.ADMIN && role !== MemberRole.OWNER)) {
      throw new ForbiddenError('You do not have permission to manage this project');
    }
  }

  private mapToResponse(project: ProjectWithRelations): ProjectResponseDto {
    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      status: project.status,
      visibility: project.visibility,
      organizationId: project.organizationId,
      ownerId: project.ownerId,
      coverImage: project.coverImage,
      tags: project.tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
      members: project.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        updatedAt: m.updatedAt,
      })),
      settings: project.settings
        ? {
            id: project.settings.id,
            defaultDocumentStatus: project.settings.defaultDocumentStatus,
            allowPublicComments: project.settings.allowPublicComments,
            enableVersioning: project.settings.enableVersioning,
            autoSaveInterval: project.settings.autoSaveInterval,
            updatedAt: project.settings.updatedAt,
          }
        : null,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }
}
