import { DocumentService } from '../../services/document.service';
import { DocumentRepository } from '../../repositories/document.repository';
import { DocumentVersionRepository } from '../../repositories/documentVersion.repository';
import { DocumentPublisher } from '../../events/document.publisher';
import { DocumentStatus, DocumentType, IDocument } from '../../models/document.model';
import { DocumentServiceError } from '../../types/document.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDoc(overrides: Partial<IDocument> = {}): IDocument {
  return {
    _id: '64b1f7c9e1d2a3b4c5d6e7f8',
    title: 'Test Document',
    slug: 'test-document',
    content: '# Hello World',
    contentHtml: '<h1>Hello World</h1>',
    excerpt: 'Hello World',
    status: DocumentStatus.DRAFT,
    type: DocumentType.GUIDE,
    projectId: 'proj-123',
    authorId: 'user-abc',
    lastEditorId: 'user-abc',
    parentId: undefined,
    order: 0,
    tags: ['guide'],
    metadata: {},
    isPublic: false,
    lockedBy: undefined,
    lockedAt: undefined,
    publishedAt: undefined,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: undefined,
    ...overrides,
  } as unknown as IDocument;
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDocRepo = {
  findById: jest.fn(),
  findBySlug: jest.fn(),
  findByProject: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  hardDelete: jest.fn(),
  search: jest.fn(),
  lock: jest.fn(),
  unlock: jest.fn(),
  getTree: jest.fn(),
  slugExists: jest.fn(),
  deleteByProjectId: jest.fn(),
} as unknown as jest.Mocked<DocumentRepository>;

const mockVersionRepo = {
  findByDocument: jest.fn(),
  findByVersion: jest.fn(),
  createVersion: jest.fn(),
  getVersionCount: jest.fn(),
  getLatestVersion: jest.fn(),
  deleteByDocumentId: jest.fn(),
} as unknown as jest.Mocked<DocumentVersionRepository>;

const mockPublisher = {
  publishDocumentCreated: jest.fn().mockResolvedValue(undefined),
  publishDocumentUpdated: jest.fn().mockResolvedValue(undefined),
  publishDocumentPublished: jest.fn().mockResolvedValue(undefined),
  publishDocumentDeleted: jest.fn().mockResolvedValue(undefined),
} as unknown as DocumentPublisher;

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('DocumentService', () => {
  let service: DocumentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DocumentService(
      mockDocRepo as unknown as DocumentRepository,
      mockVersionRepo as unknown as DocumentVersionRepository,
      mockPublisher,
    );
  });

  // ── createDocument ─────────────────────────────────────────────────────────

  describe('createDocument', () => {
    it('should create a document with a unique slug and return DTO', async () => {
      const doc = makeDoc();
      mockDocRepo.slugExists.mockResolvedValue(false);
      mockDocRepo.create.mockResolvedValue(doc);
      mockVersionRepo.createVersion.mockResolvedValue({ _id: 'v1', version: 1 } as never);

      const result = await service.createDocument('user-abc', 'proj-123', {
        title: 'Test Document',
        content: '# Hello World',
      });

      expect(mockDocRepo.slugExists).toHaveBeenCalledWith('proj-123', 'test-document');
      expect(mockDocRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Document',
          slug: 'test-document',
          projectId: 'proj-123',
          authorId: 'user-abc',
        }),
      );
      expect(mockVersionRepo.createVersion).toHaveBeenCalledWith(doc, 'Initial version');
      expect(mockPublisher.publishDocumentCreated).toHaveBeenCalledWith(doc);
      expect(result.slug).toBe('test-document');
      expect(result.status).toBe(DocumentStatus.DRAFT);
    });

    it('should append numeric suffix when slug already exists', async () => {
      const doc = makeDoc({ slug: 'test-document-1' });
      // First call returns true (slug taken), second returns false (available)
      mockDocRepo.slugExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      mockDocRepo.create.mockResolvedValue(doc);
      mockVersionRepo.createVersion.mockResolvedValue({ _id: 'v1', version: 1 } as never);

      const result = await service.createDocument('user-abc', 'proj-123', {
        title: 'Test Document',
      });

      expect(result.slug).toBe('test-document-1');
      expect(mockDocRepo.slugExists).toHaveBeenCalledTimes(2);
    });
  });

  // ── getDocument ────────────────────────────────────────────────────────────

  describe('getDocument', () => {
    it('should return document DTO when found', async () => {
      const doc = makeDoc();
      mockDocRepo.findById.mockResolvedValue(doc);

      const result = await service.getDocument('64b1f7c9e1d2a3b4c5d6e7f8');

      expect(result.id).toBe(String(doc._id));
      expect(result.title).toBe(doc.title);
    });

    it('should throw DOCUMENT_NOT_FOUND when document does not exist', async () => {
      mockDocRepo.findById.mockResolvedValue(null);

      await expect(service.getDocument('nonexistent-id')).rejects.toMatchObject({
        code: 'DOCUMENT_NOT_FOUND',
        statusCode: 404,
      });
    });
  });

  // ── updateDocument ─────────────────────────────────────────────────────────

  describe('updateDocument', () => {
    it('should update and snapshot a new version', async () => {
      const existing = makeDoc();
      const updated = makeDoc({ title: 'Updated Title', slug: 'updated-title' });

      mockDocRepo.findById.mockResolvedValue(existing);
      mockDocRepo.slugExists.mockResolvedValue(false);
      mockDocRepo.update.mockResolvedValue(updated);
      mockVersionRepo.createVersion.mockResolvedValue({ version: 2 } as never);

      const result = await service.updateDocument('64b1f7c9e1d2a3b4c5d6e7f8', 'user-abc', {
        title: 'Updated Title',
        changeDescription: 'Fixed title',
      });

      expect(result.title).toBe('Updated Title');
      expect(mockVersionRepo.createVersion).toHaveBeenCalledWith(updated, 'Fixed title');
      expect(mockPublisher.publishDocumentUpdated).toHaveBeenCalledWith(updated);
    });

    it('should throw DOCUMENT_LOCKED when doc is locked by another user', async () => {
      const locked = makeDoc({ lockedBy: 'other-user', lockedAt: new Date() });
      mockDocRepo.findById.mockResolvedValue(locked);

      await expect(
        service.updateDocument('64b1f7c9e1d2a3b4c5d6e7f8', 'user-abc', { title: 'New' }),
      ).rejects.toMatchObject({ code: 'DOCUMENT_LOCKED', statusCode: 409 });
    });
  });

  // ── deleteDocument ─────────────────────────────────────────────────────────

  describe('deleteDocument', () => {
    it('should soft-delete document and publish event', async () => {
      const doc = makeDoc();
      mockDocRepo.findById.mockResolvedValue(doc);
      mockDocRepo.softDelete.mockResolvedValue(doc);

      await service.deleteDocument('64b1f7c9e1d2a3b4c5d6e7f8', 'user-abc');

      expect(mockDocRepo.softDelete).toHaveBeenCalledWith('64b1f7c9e1d2a3b4c5d6e7f8');
      expect(mockPublisher.publishDocumentDeleted).toHaveBeenCalledWith(
        '64b1f7c9e1d2a3b4c5d6e7f8',
        'proj-123',
        'user-abc',
      );
    });

    it('should throw DOCUMENT_NOT_FOUND when document does not exist', async () => {
      mockDocRepo.findById.mockResolvedValue(null);

      await expect(
        service.deleteDocument('nonexistent', 'user-abc'),
      ).rejects.toMatchObject({ code: 'DOCUMENT_NOT_FOUND' });
    });
  });

  // ── publishDocument ────────────────────────────────────────────────────────

  describe('publishDocument', () => {
    it('should transition from REVIEW to PUBLISHED and publish event', async () => {
      const doc = makeDoc({ status: DocumentStatus.REVIEW });
      const published = makeDoc({
        status: DocumentStatus.PUBLISHED,
        publishedAt: new Date(),
      });

      mockDocRepo.findById.mockResolvedValue(doc);
      mockDocRepo.update.mockResolvedValue(published);

      const result = await service.publishDocument('64b1f7c9e1d2a3b4c5d6e7f8', 'user-abc');

      expect(result.status).toBe(DocumentStatus.PUBLISHED);
      expect(mockPublisher.publishDocumentPublished).toHaveBeenCalledWith(published);
    });

    it('should throw INVALID_STATUS_TRANSITION from ARCHIVED to PUBLISHED', async () => {
      const doc = makeDoc({ status: DocumentStatus.ARCHIVED });
      mockDocRepo.findById.mockResolvedValue(doc);

      await expect(
        service.publishDocument('64b1f7c9e1d2a3b4c5d6e7f8', 'user-abc'),
      ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    });
  });

  // ── lockDocument ───────────────────────────────────────────────────────────

  describe('lockDocument', () => {
    it('should lock an unlocked document', async () => {
      const locked = makeDoc({ lockedBy: 'user-abc', lockedAt: new Date() });
      mockDocRepo.lock.mockResolvedValue(locked);

      const result = await service.lockDocument('64b1f7c9e1d2a3b4c5d6e7f8', 'user-abc');

      expect(result.lockedBy).toBe('user-abc');
    });

    it('should throw DOCUMENT_LOCKED when lock fails due to another user', async () => {
      mockDocRepo.lock.mockResolvedValue(null);
      // findById is called when lock returns null
      const existing = makeDoc({ lockedBy: 'other-user' });
      mockDocRepo.findById.mockResolvedValue(existing);

      await expect(
        service.lockDocument('64b1f7c9e1d2a3b4c5d6e7f8', 'user-abc'),
      ).rejects.toMatchObject({ code: 'DOCUMENT_LOCKED', statusCode: 409 });
    });
  });

  // ── searchDocuments ────────────────────────────────────────────────────────

  describe('searchDocuments', () => {
    it('should search and return paginated results', async () => {
      const doc = makeDoc();
      mockDocRepo.search.mockResolvedValue({
        data: [doc],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

      const result = await service.searchDocuments({
        query: 'Hello',
        projectId: 'proj-123',
      });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should throw VALIDATION_ERROR when projectId is missing', async () => {
      await expect(
        service.searchDocuments({ query: 'Hello' }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });
  });

  // ── getDocumentTree ────────────────────────────────────────────────────────

  describe('getDocumentTree', () => {
    it('should return document tree', async () => {
      const tree = [
        {
          id: '1',
          title: 'Root',
          slug: 'root',
          status: DocumentStatus.PUBLISHED,
          type: DocumentType.GUIDE,
          order: 0,
          children: [],
        },
      ];
      mockDocRepo.getTree.mockResolvedValue(tree);

      const result = await service.getDocumentTree('proj-123');

      expect(result).toEqual(tree);
      expect(mockDocRepo.getTree).toHaveBeenCalledWith('proj-123');
    });
  });
});

// ─── DocumentServiceError ──────────────────────────────────────────────────

describe('DocumentServiceError', () => {
  it('should have correct name and properties', () => {
    const err = new DocumentServiceError('DOCUMENT_NOT_FOUND', 'Not found', 404);

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('DocumentServiceError');
    expect(err.code).toBe('DOCUMENT_NOT_FOUND');
    expect(err.message).toBe('Not found');
    expect(err.statusCode).toBe(404);
  });
});
