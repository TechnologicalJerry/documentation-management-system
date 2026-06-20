import { MemberRole, ProjectStatus, ProjectVisibility } from '@prisma/client';
import { ProjectService } from '../../services/project.service';
import {
  IProjectRepository,
  FindAllResult,
  ProjectWithRelations,
} from '../../repositories/project.repository';
import {
  IProjectMemberRepository,
} from '../../repositories/projectMember.repository';
import { ProjectPublisher } from '../../events/project.publisher';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../lib/errors';
import { CreateProjectDto, UpdateProjectDto } from '../../types/project.types';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function makeProject(overrides: Partial<ProjectWithRelations> = {}): ProjectWithRelations {
  return {
    id: 'project-1',
    name: 'Test Project',
    slug: 'test-project',
    description: 'A test project',
    status: ProjectStatus.ACTIVE,
    visibility: ProjectVisibility.PRIVATE,
    organizationId: null,
    ownerId: 'user-1',
    coverImage: null,
    tags: [],
    members: [
      {
        id: 'member-1',
        projectId: 'project-1',
        userId: 'user-1',
        role: MemberRole.OWNER,
        joinedAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    ],
    settings: {
      id: 'settings-1',
      projectId: 'project-1',
      defaultDocumentStatus: 'DRAFT',
      allowPublicComments: false,
      enableVersioning: true,
      autoSaveInterval: 30,
      updatedAt: new Date('2024-01-01'),
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    ...overrides,
  };
}

function makeMockProjectRepo(
  overrides: Partial<IProjectRepository> = {},
): IProjectRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findBySlug: jest.fn().mockResolvedValue(null),
    findByOwner: jest.fn().mockResolvedValue({ projects: [], total: 0 } as FindAllResult),
    findByMember: jest.fn().mockResolvedValue({ projects: [], total: 0 } as FindAllResult),
    findAll: jest.fn().mockResolvedValue({ projects: [], total: 0 } as FindAllResult),
    create: jest.fn().mockResolvedValue(makeProject()),
    update: jest.fn().mockResolvedValue(makeProject()),
    softDelete: jest.fn().mockResolvedValue(makeProject()),
    getStats: jest.fn().mockResolvedValue({
      projectId: 'project-1',
      totalMembers: 1,
      membersByRole: { OWNER: 1 },
      totalTags: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    slugExists: jest.fn().mockResolvedValue(false),
    ...overrides,
  };
}

function makeMockMemberRepo(
  overrides: Partial<IProjectMemberRepository> = {},
): IProjectMemberRepository {
  return {
    findByProject: jest.fn().mockResolvedValue([]),
    findByUser: jest.fn().mockResolvedValue([]),
    findMember: jest.fn().mockResolvedValue(null),
    addMember: jest.fn().mockResolvedValue({ id: 'm-1', projectId: 'project-1', userId: 'user-2', role: MemberRole.VIEWER, joinedAt: new Date(), updatedAt: new Date() }),
    updateMemberRole: jest.fn().mockResolvedValue({ id: 'm-1', projectId: 'project-1', userId: 'user-2', role: MemberRole.EDITOR, joinedAt: new Date(), updatedAt: new Date() }),
    removeMember: jest.fn().mockResolvedValue({ id: 'm-1', projectId: 'project-1', userId: 'user-2', role: MemberRole.VIEWER, joinedAt: new Date(), updatedAt: new Date() }),
    isMember: jest.fn().mockResolvedValue(false),
    getMemberRole: jest.fn().mockResolvedValue(null),
    countByProject: jest.fn().mockResolvedValue(0),
    createInvitation: jest.fn(),
    findInvitationByToken: jest.fn().mockResolvedValue(null),
    findInvitationsByProject: jest.fn().mockResolvedValue([]),
    findPendingInvitationByEmail: jest.fn().mockResolvedValue(null),
    acceptInvitation: jest.fn(),
    deleteExpiredInvitations: jest.fn().mockResolvedValue(0),
    ...overrides,
  };
}

function makeMockPublisher(): ProjectPublisher {
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    publishProjectCreated: jest.fn().mockResolvedValue(undefined),
    publishProjectUpdated: jest.fn().mockResolvedValue(undefined),
    publishProjectDeleted: jest.fn().mockResolvedValue(undefined),
    publishMemberAdded: jest.fn().mockResolvedValue(undefined),
    publishMemberRemoved: jest.fn().mockResolvedValue(undefined),
    publishMemberRoleChanged: jest.fn().mockResolvedValue(undefined),
    publishInvitationSent: jest.fn().mockResolvedValue(undefined),
    publishInvitationAccepted: jest.fn().mockResolvedValue(undefined),
  } as unknown as ProjectPublisher;
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('ProjectService', () => {
  let service: ProjectService;
  let projectRepo: IProjectRepository;
  let memberRepo: IProjectMemberRepository;
  let publisher: ProjectPublisher;

  beforeEach(() => {
    projectRepo = makeMockProjectRepo();
    memberRepo = makeMockMemberRepo();
    publisher = makeMockPublisher();
    service = new ProjectService(projectRepo, memberRepo, publisher);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── createProject ─────────────────────────────────────────────────────────

  describe('createProject', () => {
    const dto: CreateProjectDto = {
      name: 'My Project',
      description: 'Test description',
      visibility: ProjectVisibility.PRIVATE,
    };

    it('should create a project and return a response DTO', async () => {
      const project = makeProject({ name: 'My Project' });
      jest.spyOn(projectRepo, 'create').mockResolvedValue(project);

      const result = await service.createProject('user-1', dto);

      expect(result.name).toBe('My Project');
      expect(result.ownerId).toBe('user-1');
      expect(projectRepo.create).toHaveBeenCalledTimes(1);
    });

    it('should generate a unique slug based on project name', async () => {
      jest.spyOn(projectRepo, 'slugExists').mockResolvedValueOnce(true).mockResolvedValue(false);

      await service.createProject('user-1', dto);

      const createCall = (projectRepo.create as jest.Mock).mock.calls[0] as [{ slug: string }];
      expect(createCall[0].slug).toMatch(/my-project-\d+/);
    });

    it('should publish a ProjectCreated event', async () => {
      await service.createProject('user-1', dto);

      expect(publisher.publishProjectCreated).toHaveBeenCalledTimes(1);
    });
  });

  // ─── getProject ────────────────────────────────────────────────────────────

  describe('getProject', () => {
    it('should return the project when found', async () => {
      const project = makeProject();
      jest.spyOn(projectRepo, 'findById').mockResolvedValue(project);

      const result = await service.getProject('project-1', 'user-1');

      expect(result.id).toBe('project-1');
    });

    it('should throw NotFoundError when project does not exist', async () => {
      jest.spyOn(projectRepo, 'findById').mockResolvedValue(null);

      await expect(service.getProject('missing', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError for a PRIVATE project when user is not a member', async () => {
      const project = makeProject({
        visibility: ProjectVisibility.PRIVATE,
        ownerId: 'other-user',
        members: [],
      });
      jest.spyOn(projectRepo, 'findById').mockResolvedValue(project);

      await expect(service.getProject('project-1', 'user-1')).rejects.toThrow(ForbiddenError);
    });

    it('should allow access to PUBLIC projects without authentication', async () => {
      const project = makeProject({ visibility: ProjectVisibility.PUBLIC });
      jest.spyOn(projectRepo, 'findById').mockResolvedValue(project);

      const result = await service.getProject('project-1', undefined);

      expect(result.id).toBe('project-1');
    });
  });

  // ─── updateProject ─────────────────────────────────────────────────────────

  describe('updateProject', () => {
    const dto: UpdateProjectDto = { name: 'Updated Name' };

    it('should update a project when called by owner', async () => {
      const project = makeProject();
      const updated = makeProject({ name: 'Updated Name' });
      jest.spyOn(projectRepo, 'findById').mockResolvedValue(project);
      jest.spyOn(projectRepo, 'update').mockResolvedValue(updated);

      const result = await service.updateProject('project-1', 'user-1', dto);

      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundError when project does not exist', async () => {
      jest.spyOn(projectRepo, 'findById').mockResolvedValue(null);

      await expect(service.updateProject('missing', 'user-1', dto)).rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError when user is only a VIEWER', async () => {
      const project = makeProject({ ownerId: 'other-user' });
      jest.spyOn(projectRepo, 'findById').mockResolvedValue(project);
      jest.spyOn(memberRepo, 'getMemberRole').mockResolvedValue(MemberRole.VIEWER);

      await expect(service.updateProject('project-1', 'user-1', dto)).rejects.toThrow(ForbiddenError);
    });

    it('should publish a ProjectUpdated event on success', async () => {
      const project = makeProject();
      jest.spyOn(projectRepo, 'findById').mockResolvedValue(project);
      jest.spyOn(projectRepo, 'update').mockResolvedValue(project);

      await service.updateProject('project-1', 'user-1', dto);

      expect(publisher.publishProjectUpdated).toHaveBeenCalledTimes(1);
    });
  });

  // ─── deleteProject ─────────────────────────────────────────────────────────

  describe('deleteProject', () => {
    it('should soft delete the project when called by owner', async () => {
      const project = makeProject();
      jest.spyOn(projectRepo, 'findById').mockResolvedValue(project);

      await service.deleteProject('project-1', 'user-1');

      expect(projectRepo.softDelete).toHaveBeenCalledWith('project-1');
    });

    it('should throw ForbiddenError when called by a non-owner', async () => {
      const project = makeProject({ ownerId: 'other-user' });
      jest.spyOn(projectRepo, 'findById').mockResolvedValue(project);

      await expect(service.deleteProject('project-1', 'user-1')).rejects.toThrow(ForbiddenError);
    });

    it('should publish a ProjectDeleted event', async () => {
      const project = makeProject();
      jest.spyOn(projectRepo, 'findById').mockResolvedValue(project);

      await service.deleteProject('project-1', 'user-1');

      expect(publisher.publishProjectDeleted).toHaveBeenCalledTimes(1);
    });
  });

  // ─── archiveProject ────────────────────────────────────────────────────────

  describe('archiveProject', () => {
    it('should archive an ACTIVE project', async () => {
      const project = makeProject({ status: ProjectStatus.ACTIVE });
      const archived = makeProject({ status: ProjectStatus.ARCHIVED });
      jest.spyOn(projectRepo, 'findById').mockResolvedValue(project);
      jest.spyOn(projectRepo, 'update').mockResolvedValue(archived);

      const result = await service.archiveProject('project-1', 'user-1');

      expect(result.status).toBe(ProjectStatus.ARCHIVED);
    });

    it('should throw ConflictError when already archived', async () => {
      const project = makeProject({ status: ProjectStatus.ARCHIVED });
      jest.spyOn(projectRepo, 'findById').mockResolvedValue(project);

      await expect(service.archiveProject('project-1', 'user-1')).rejects.toThrow(ConflictError);
    });
  });

  // ─── getProjectStats ───────────────────────────────────────────────────────

  describe('getProjectStats', () => {
    it('should return project statistics', async () => {
      const project = makeProject();
      jest.spyOn(projectRepo, 'findById').mockResolvedValue(project);

      const stats = await service.getProjectStats('project-1');

      expect(stats.projectId).toBe('project-1');
      expect(projectRepo.getStats).toHaveBeenCalledWith('project-1');
    });

    it('should throw NotFoundError when project does not exist', async () => {
      jest.spyOn(projectRepo, 'findById').mockResolvedValue(null);

      await expect(service.getProjectStats('missing')).rejects.toThrow(NotFoundError);
    });
  });
});
