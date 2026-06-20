import { TemplateService, AppError } from '../../services/template.service';
import type { ITemplateRepository } from '../../repositories/template.repository';
import {
  TemplateCategory,
  TemplateType,
  type ITemplateDocument,
  type ITemplateVersionDocument,
  type ITemplateRatingDocument,
  type PaginatedTemplates,
} from '../../types/template.types';
import { StatusCodes } from 'http-status-codes';
import type { Types } from 'mongoose';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeObjectId(): Types.ObjectId {
  // Create a minimal ObjectId-shaped object that satisfies the type
  return { toString: () => 'mock-id' } as unknown as Types.ObjectId;
}

function buildTemplate(overrides: Partial<ITemplateDocument> = {}): ITemplateDocument {
  const base: Partial<ITemplateDocument> = {
    _id: makeObjectId(),
    id: 'template-id-1',
    name: 'Test Template',
    slug: 'test-template',
    description: 'A test template description with enough text.',
    content: '# Hello {{PROJECT_NAME}}',
    contentHtml: '<h1>Hello {{PROJECT_NAME}}</h1>',
    category: TemplateCategory.API_DOCS,
    type: TemplateType.USER,
    authorId: 'user-1',
    isPublic: false,
    isActive: true,
    tags: ['test'],
    variables: [
      { name: 'PROJECT_NAME', description: 'Project name', required: true, defaultValue: '' },
    ],
    usageCount: 0,
    rating: 0,
    metadata: {},
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: undefined,
  };
  return { ...base, ...overrides } as ITemplateDocument;
}

function buildVersion(overrides: Partial<ITemplateVersionDocument> = {}): ITemplateVersionDocument {
  const base: Partial<ITemplateVersionDocument> = {
    _id: makeObjectId(),
    id: 'version-id-1',
    templateId: 'template-id-1',
    version: '1.0.0',
    content: '# Hello',
    contentHtml: '<h1>Hello</h1>',
    changelog: 'Initial version',
    createdBy: 'user-1',
    createdAt: new Date('2024-01-01'),
  };
  return { ...base, ...overrides } as ITemplateVersionDocument;
}

function buildRating(overrides: Partial<ITemplateRatingDocument> = {}): ITemplateRatingDocument {
  const base: Partial<ITemplateRatingDocument> = {
    _id: makeObjectId(),
    id: 'rating-id-1',
    templateId: 'template-id-1',
    userId: 'user-1',
    rating: 4,
    review: 'Great template',
    createdAt: new Date('2024-01-01'),
  };
  return { ...base, ...overrides } as ITemplateRatingDocument;
}

function buildPaginatedResult(items: ITemplateDocument[] = []): PaginatedTemplates {
  return {
    data: items,
    total: items.length,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  };
}

// ─── Mock repository factory ──────────────────────────────────────────────────

function createMockRepository(
  overrides: Partial<ITemplateRepository> = {},
): jest.Mocked<ITemplateRepository> {
  return {
    findById: jest.fn(),
    findBySlug: jest.fn(),
    findAll: jest.fn(),
    findByType: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    incrementUsage: jest.fn(),
    updateRating: jest.fn(),
    createVersion: jest.fn(),
    findVersionsByTemplateId: jest.fn(),
    findLatestVersion: jest.fn(),
    upsertRating: jest.fn(),
    findRatingByUser: jest.fn(),
    findRatingsByTemplate: jest.fn(),
    countByAuthor: jest.fn(),
    ...overrides,
  } as jest.Mocked<ITemplateRepository>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TemplateService', () => {
  let mockRepo: jest.Mocked<ITemplateRepository>;
  let service: TemplateService;

  beforeEach(() => {
    mockRepo = createMockRepository();
    service = new TemplateService(mockRepo);
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('createTemplate', () => {
    it('creates a template and snapshots an initial version', async () => {
      const template = buildTemplate();
      mockRepo.create.mockResolvedValue(template);
      mockRepo.createVersion.mockResolvedValue(buildVersion());

      const result = await service.createTemplate('user-1', {
        name: 'Test Template',
        description: 'A test template description with enough text.',
        content: '# Hello',
        category: TemplateCategory.API_DOCS,
      });

      expect(mockRepo.create).toHaveBeenCalledTimes(1);
      expect(mockRepo.createVersion).toHaveBeenCalledTimes(1);
      expect(mockRepo.createVersion).toHaveBeenCalledWith(
        String(template._id),
        '# Hello',
        expect.any(String),
        'user-1',
        'Initial version',
      );
      expect(result).toBe(template);
    });

    it('passes contentHtml to the repository', async () => {
      const template = buildTemplate();
      mockRepo.create.mockResolvedValue(template);
      mockRepo.createVersion.mockResolvedValue(buildVersion());

      await service.createTemplate('user-1', {
        name: 'HTML Template',
        description: 'Description long enough to pass validation.',
        content: '# Heading',
        category: TemplateCategory.README,
      });

      const createCall = mockRepo.create.mock.calls[0];
      expect(createCall).toBeDefined();
      const dto = createCall![1] as { contentHtml?: string };
      expect(dto.contentHtml).toBeDefined();
      expect(typeof dto.contentHtml).toBe('string');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('getTemplate', () => {
    it('returns a template when found', async () => {
      const template = buildTemplate();
      mockRepo.findById.mockResolvedValue(template);

      const result = await service.getTemplate('template-id-1');

      expect(mockRepo.findById).toHaveBeenCalledWith('template-id-1');
      expect(result).toBe(template);
    });

    it('throws NOT_FOUND when the template does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.getTemplate('nonexistent')).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        message: expect.stringContaining('nonexistent'),
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('getTemplates', () => {
    it('delegates to the repository and returns paginated results', async () => {
      const paginated = buildPaginatedResult([buildTemplate()]);
      mockRepo.findAll.mockResolvedValue(paginated);

      const result = await service.getTemplates({ page: 1, limit: 20 });

      expect(mockRepo.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
      expect(result).toBe(paginated);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('updateTemplate', () => {
    it('updates a template owned by the user', async () => {
      const original = buildTemplate({ authorId: 'user-1', type: TemplateType.USER });
      const updated = buildTemplate({ name: 'Updated', authorId: 'user-1' });

      mockRepo.findById.mockResolvedValue(original);
      mockRepo.update.mockResolvedValue(updated);
      mockRepo.createVersion.mockResolvedValue(buildVersion());

      const result = await service.updateTemplate('template-id-1', 'user-1', { name: 'Updated' });

      expect(mockRepo.update).toHaveBeenCalledTimes(1);
      expect(result).toBe(updated);
      // No content change → no new version created
      expect(mockRepo.createVersion).not.toHaveBeenCalled();
    });

    it('creates a new version when content changes', async () => {
      const original = buildTemplate({ authorId: 'user-1' });
      const updated = buildTemplate({ content: '# New Content', authorId: 'user-1' });

      mockRepo.findById.mockResolvedValue(original);
      mockRepo.update.mockResolvedValue(updated);
      mockRepo.createVersion.mockResolvedValue(buildVersion());

      await service.updateTemplate('template-id-1', 'user-1', {
        content: '# New Content',
        changelog: 'Added new section',
      });

      expect(mockRepo.createVersion).toHaveBeenCalledTimes(1);
      expect(mockRepo.createVersion).toHaveBeenCalledWith(
        'template-id-1',
        '# New Content',
        expect.any(String),
        'user-1',
        'Added new section',
      );
    });

    it('throws FORBIDDEN when a non-owner tries to update', async () => {
      const template = buildTemplate({ authorId: 'owner-user', type: TemplateType.USER });
      mockRepo.findById.mockResolvedValue(template);

      await expect(
        service.updateTemplate('template-id-1', 'other-user', { name: 'Hack' }),
      ).rejects.toMatchObject({ statusCode: StatusCodes.FORBIDDEN });
    });

    it('throws FORBIDDEN when a user tries to update a SYSTEM template', async () => {
      const template = buildTemplate({ type: TemplateType.SYSTEM, authorId: 'system' });
      mockRepo.findById.mockResolvedValue(template);

      await expect(
        service.updateTemplate('template-id-1', 'any-user', { name: 'Modified System' }),
      ).rejects.toMatchObject({ statusCode: StatusCodes.FORBIDDEN });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('deleteTemplate', () => {
    it('soft-deletes a template owned by the user', async () => {
      const template = buildTemplate({ authorId: 'user-1', type: TemplateType.USER });
      mockRepo.findById.mockResolvedValue(template);
      mockRepo.softDelete.mockResolvedValue(template);

      await expect(service.deleteTemplate('template-id-1', 'user-1')).resolves.toBeUndefined();
      expect(mockRepo.softDelete).toHaveBeenCalledWith('template-id-1');
    });

    it('throws FORBIDDEN when a non-owner attempts deletion', async () => {
      const template = buildTemplate({ authorId: 'owner-user', type: TemplateType.USER });
      mockRepo.findById.mockResolvedValue(template);

      await expect(service.deleteTemplate('template-id-1', 'intruder')).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
      });
      expect(mockRepo.softDelete).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('publishTemplate', () => {
    it('publishes a private template', async () => {
      const template = buildTemplate({ isPublic: false, authorId: 'user-1', type: TemplateType.USER });
      const published = buildTemplate({ isPublic: true, authorId: 'user-1' });

      mockRepo.findById.mockResolvedValue(template);
      mockRepo.update.mockResolvedValue(published);

      const result = await service.publishTemplate('template-id-1', 'user-1');

      expect(mockRepo.update).toHaveBeenCalledWith('template-id-1', { isPublic: true });
      expect(result.isPublic).toBe(true);
    });

    it('throws CONFLICT when the template is already public', async () => {
      const template = buildTemplate({ isPublic: true, authorId: 'user-1', type: TemplateType.USER });
      mockRepo.findById.mockResolvedValue(template);

      await expect(service.publishTemplate('template-id-1', 'user-1')).rejects.toMatchObject({
        statusCode: StatusCodes.CONFLICT,
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('unpublishTemplate', () => {
    it('unpublishes a public template', async () => {
      const template = buildTemplate({ isPublic: true, authorId: 'user-1', type: TemplateType.USER });
      const unpublished = buildTemplate({ isPublic: false, authorId: 'user-1' });

      mockRepo.findById.mockResolvedValue(template);
      mockRepo.update.mockResolvedValue(unpublished);

      const result = await service.unpublishTemplate('template-id-1', 'user-1');
      expect(result.isPublic).toBe(false);
    });

    it('throws CONFLICT when the template is already private', async () => {
      const template = buildTemplate({ isPublic: false, authorId: 'user-1', type: TemplateType.USER });
      mockRepo.findById.mockResolvedValue(template);

      await expect(service.unpublishTemplate('template-id-1', 'user-1')).rejects.toMatchObject({
        statusCode: StatusCodes.CONFLICT,
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('applyTemplate', () => {
    it('substitutes variables and increments usage count', async () => {
      const template = buildTemplate({
        content: '# Hello {{PROJECT_NAME}}\n\nAuthor: {{AUTHOR}}',
        variables: [
          { name: 'PROJECT_NAME', description: 'Project name', required: true, defaultValue: '' },
          { name: 'AUTHOR', description: 'Author name', required: false, defaultValue: 'Anonymous' },
        ],
      });
      mockRepo.findById.mockResolvedValue(template);
      mockRepo.incrementUsage.mockResolvedValue(undefined);

      const result = await service.applyTemplate('template-id-1', {
        variables: { PROJECT_NAME: 'MyApp' },
      });

      expect(result.renderedContent).toContain('MyApp');
      expect(result.renderedContent).toContain('Anonymous');
      expect(result.appliedVariables['PROJECT_NAME']).toBe('MyApp');
      expect(result.appliedVariables['AUTHOR']).toBe('Anonymous');
      expect(mockRepo.incrementUsage).toHaveBeenCalledWith('template-id-1');
    });

    it('leaves unreferenced placeholders intact when variable not provided', async () => {
      const template = buildTemplate({
        content: 'Hello {{UNKNOWN_VAR}}',
        variables: [],
      });
      mockRepo.findById.mockResolvedValue(template);
      mockRepo.incrementUsage.mockResolvedValue(undefined);

      const result = await service.applyTemplate('template-id-1', { variables: {} });

      expect(result.renderedContent).toContain('{{UNKNOWN_VAR}}');
    });

    it('throws BAD_REQUEST when a required variable is missing with no default', async () => {
      const template = buildTemplate({
        content: '# {{REQUIRED_VAR}}',
        variables: [
          {
            name: 'REQUIRED_VAR',
            description: 'A required variable',
            required: true,
            defaultValue: '',
          },
        ],
      });
      mockRepo.findById.mockResolvedValue(template);

      await expect(
        service.applyTemplate('template-id-1', { variables: {} }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        message: expect.stringContaining('REQUIRED_VAR'),
      });

      expect(mockRepo.incrementUsage).not.toHaveBeenCalled();
    });

    it('throws NOT_FOUND when the template does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        service.applyTemplate('nonexistent', { variables: {} }),
      ).rejects.toMatchObject({ statusCode: StatusCodes.NOT_FOUND });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('rateTemplate', () => {
    it('upserts a rating and recalculates the aggregate', async () => {
      const template = buildTemplate({ rating: 0 });
      const ratingRecord = buildRating({ rating: 5 });
      const updatedTemplate = buildTemplate({ rating: 5 });

      mockRepo.findById
        .mockResolvedValueOnce(template)    // initial existence check
        .mockResolvedValueOnce(updatedTemplate); // after updateRating
      mockRepo.upsertRating.mockResolvedValue(ratingRecord);
      mockRepo.updateRating.mockResolvedValue(undefined);

      const result = await service.rateTemplate('template-id-1', 'user-1', 5, 'Excellent!');

      expect(mockRepo.upsertRating).toHaveBeenCalledWith('template-id-1', 'user-1', 5, 'Excellent!');
      expect(mockRepo.updateRating).toHaveBeenCalledWith('template-id-1');
      expect(result.template.rating).toBe(5);
      expect(result.ratingRecord.rating).toBe(5);
    });

    it('throws NOT_FOUND when the template does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.rateTemplate('bad-id', 'user-1', 4)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
      });
      expect(mockRepo.upsertRating).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('getSystemTemplates', () => {
    it('returns templates filtered by SYSTEM type', async () => {
      const system = [buildTemplate({ type: TemplateType.SYSTEM })];
      mockRepo.findByType.mockResolvedValue(system);

      const result = await service.getSystemTemplates();

      expect(mockRepo.findByType).toHaveBeenCalledWith(TemplateType.SYSTEM);
      expect(result).toBe(system);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('getTemplateVersions', () => {
    it('returns version history for a valid template', async () => {
      const template = buildTemplate();
      const versions = [buildVersion(), buildVersion({ version: '1.0.1' })];

      mockRepo.findById.mockResolvedValue(template);
      mockRepo.findVersionsByTemplateId.mockResolvedValue(versions);

      const result = await service.getTemplateVersions('template-id-1');

      expect(result).toBe(versions);
      expect(mockRepo.findVersionsByTemplateId).toHaveBeenCalledWith('template-id-1');
    });

    it('throws NOT_FOUND for a non-existent template', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.getTemplateVersions('bad-id')).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
      });
      expect(mockRepo.findVersionsByTemplateId).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('searchTemplates', () => {
    it('passes the search term to findAll', async () => {
      const paginated = buildPaginatedResult();
      mockRepo.findAll.mockResolvedValue(paginated);

      await service.searchTemplates('api guide', { category: TemplateCategory.API_DOCS });

      expect(mockRepo.findAll).toHaveBeenCalledWith({
        category: TemplateCategory.API_DOCS,
        search: 'api guide',
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('getCategories', () => {
    it('returns all enum values from TemplateCategory', () => {
      const categories = service.getCategories();
      expect(categories).toEqual(expect.arrayContaining(Object.values(TemplateCategory)));
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('getTemplateRatings', () => {
    it('returns ratings for a valid template', async () => {
      const template = buildTemplate();
      const ratings = [buildRating(), buildRating({ rating: 3, userId: 'user-2' })];

      mockRepo.findById.mockResolvedValue(template);
      mockRepo.findRatingsByTemplate.mockResolvedValue(ratings);

      const result = await service.getTemplateRatings('template-id-1');

      expect(result).toBe(ratings);
      expect(mockRepo.findRatingsByTemplate).toHaveBeenCalledWith('template-id-1');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('AppError', () => {
    it('is an instance of Error with correct properties', () => {
      const err = new AppError(StatusCodes.NOT_FOUND, 'Not found');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(err.message).toBe('Not found');
      expect(err.isOperational).toBe(true);
    });
  });
});
