import { StatusCodes } from 'http-status-codes';
import slugify from './slugify.util';
import { IDocumentRepository } from '../repositories/document.repository';
import { IDocumentVersionRepository } from '../repositories/documentVersion.repository';
import { DocumentStatus, DocumentType, IDocument } from '../models/document.model';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  DocumentQueryDto,
  DocumentResponseDto,
  PaginatedResponseDto,
  DocumentTreeNodeDto,
  DocumentServiceError,
  SearchDocumentsDto,
} from '../types/document.types';
import { DocumentPublisher } from '../events/document.publisher';
import { logger } from '../lib/logger';

// ─── Interface ───────────────────────────────────────────────────────────────

export interface IDocumentService {
  createDocument(
    userId: string,
    projectId: string,
    dto: CreateDocumentDto,
  ): Promise<DocumentResponseDto>;
  getDocument(id: string, _userId?: string): Promise<DocumentResponseDto>;
  getDocuments(
    projectId: string,
    query: DocumentQueryDto,
  ): Promise<PaginatedResponseDto<DocumentResponseDto>>;
  updateDocument(id: string, userId: string, dto: UpdateDocumentDto): Promise<DocumentResponseDto>;
  deleteDocument(id: string, userId: string): Promise<void>;
  publishDocument(id: string, userId: string): Promise<DocumentResponseDto>;
  archiveDocument(id: string, userId: string): Promise<DocumentResponseDto>;
  submitForReview(id: string, userId: string): Promise<DocumentResponseDto>;
  lockDocument(id: string, userId: string): Promise<DocumentResponseDto>;
  unlockDocument(id: string, userId: string): Promise<DocumentResponseDto>;
  searchDocuments(dto: SearchDocumentsDto): Promise<PaginatedResponseDto<DocumentResponseDto>>;
  getDocumentTree(projectId: string): Promise<DocumentTreeNodeDto[]>;
}

// ─── Valid status transitions ─────────────────────────────────────────────────

const STATUS_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  [DocumentStatus.DRAFT]: [DocumentStatus.REVIEW, DocumentStatus.ARCHIVED],
  [DocumentStatus.REVIEW]: [DocumentStatus.PUBLISHED, DocumentStatus.DRAFT, DocumentStatus.ARCHIVED],
  [DocumentStatus.PUBLISHED]: [DocumentStatus.ARCHIVED, DocumentStatus.DRAFT],
  [DocumentStatus.ARCHIVED]: [DocumentStatus.DRAFT],
};

// ─── Mapper ───────────────────────────────────────────────────────────────────

function toDto(doc: IDocument): DocumentResponseDto {
  return {
    id: String(doc._id),
    title: doc.title,
    slug: doc.slug,
    content: doc.content,
    contentHtml: doc.contentHtml,
    excerpt: doc.excerpt,
    status: doc.status,
    type: doc.type,
    projectId: doc.projectId,
    authorId: doc.authorId,
    lastEditorId: doc.lastEditorId,
    parentId: doc.parentId,
    order: doc.order,
    tags: doc.tags,
    metadata: doc.metadata,
    isPublic: doc.isPublic,
    lockedBy: doc.lockedBy || undefined,
    lockedAt: doc.lockedAt?.toISOString(),
    publishedAt: doc.publishedAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

// ─── Implementation ──────────────────────────────────────────────────────────

export class DocumentService implements IDocumentService {
  constructor(
    private readonly documentRepo: IDocumentRepository,
    private readonly versionRepo: IDocumentVersionRepository,
    private readonly publisher: DocumentPublisher,
  ) {}

  async createDocument(
    userId: string,
    projectId: string,
    dto: CreateDocumentDto,
  ): Promise<DocumentResponseDto> {
    const baseSlug = slugify(dto.title);
    let slug = baseSlug;
    let suffix = 1;

    // Ensure slug uniqueness within the project
    while (await this.documentRepo.slugExists(projectId, slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix++;
    }

    const doc = await this.documentRepo.create({
      title: dto.title,
      slug,
      content: dto.content ?? '',
      contentHtml: dto.contentHtml,
      excerpt: dto.excerpt,
      status: DocumentStatus.DRAFT,
      type: dto.type ?? DocumentType.CUSTOM,
      projectId,
      authorId: userId,
      lastEditorId: userId,
      parentId: dto.parentId,
      order: dto.order ?? 0,
      tags: dto.tags ?? [],
      metadata: dto.metadata ?? {},
      isPublic: dto.isPublic ?? false,
    });

    // Create initial version snapshot
    await this.versionRepo.createVersion(doc, 'Initial version');

    await this.publisher.publishDocumentCreated(doc);

    logger.info('Document created', { documentId: doc._id, projectId, userId });

    return toDto(doc);
  }

  async getDocument(id: string, _userId?: string): Promise<DocumentResponseDto> {
    const doc = await this.documentRepo.findById(id);
    if (doc === null) {
      throw new DocumentServiceError('DOCUMENT_NOT_FOUND', `Document ${id} not found`, StatusCodes.NOT_FOUND);
    }

    return toDto(doc);
  }

  async getDocuments(
    projectId: string,
    query: DocumentQueryDto,
  ): Promise<PaginatedResponseDto<DocumentResponseDto>> {
    const result = await this.documentRepo.findByProject(projectId, query);

    return {
      data: result.data.map(toDto),
      pagination: result.pagination,
    };
  }

  async updateDocument(
    id: string,
    userId: string,
    dto: UpdateDocumentDto,
  ): Promise<DocumentResponseDto> {
    const existing = await this.documentRepo.findById(id);
    if (existing === null) {
      throw new DocumentServiceError('DOCUMENT_NOT_FOUND', `Document ${id} not found`, StatusCodes.NOT_FOUND);
    }

    // Check if document is locked by someone else
    if (
      existing.lockedBy !== undefined &&
      existing.lockedBy !== null &&
      existing.lockedBy !== '' &&
      existing.lockedBy !== userId
    ) {
      throw new DocumentServiceError(
        'DOCUMENT_LOCKED',
        `Document is locked by another user`,
        StatusCodes.CONFLICT,
      );
    }

    // Build slug update if title changed
    let slug = existing.slug;
    if (dto.title !== undefined && dto.title !== existing.title) {
      const baseSlug = slugify(dto.title);
      slug = baseSlug;
      let suffix = 1;
      while (await this.documentRepo.slugExists(existing.projectId, slug, id)) {
        slug = `${baseSlug}-${suffix}`;
        suffix++;
      }
    }

    const updateData: Partial<IDocument> = {
      ...dto,
      slug,
      lastEditorId: userId,
    };
    // changeDescription is not a model field — extract and discard from update payload
    delete (updateData as UpdateDocumentDto).changeDescription;

    const updated = await this.documentRepo.update(id, updateData);
    if (updated === null) {
      throw new DocumentServiceError('DOCUMENT_NOT_FOUND', `Document ${id} not found`, StatusCodes.NOT_FOUND);
    }

    // Snapshot a new version
    await this.versionRepo.createVersion(updated, dto.changeDescription);

    await this.publisher.publishDocumentUpdated(updated);

    logger.info('Document updated', { documentId: id, userId });

    return toDto(updated);
  }

  async deleteDocument(id: string, userId: string): Promise<void> {
    const existing = await this.documentRepo.findById(id);
    if (existing === null) {
      throw new DocumentServiceError('DOCUMENT_NOT_FOUND', `Document ${id} not found`, StatusCodes.NOT_FOUND);
    }

    await this.documentRepo.softDelete(id);
    await this.publisher.publishDocumentDeleted(id, existing.projectId, userId);

    logger.info('Document deleted', { documentId: id, userId });
  }

  private async transitionStatus(
    id: string,
    userId: string,
    targetStatus: DocumentStatus,
  ): Promise<DocumentResponseDto> {
    const existing = await this.documentRepo.findById(id);
    if (existing === null) {
      throw new DocumentServiceError('DOCUMENT_NOT_FOUND', `Document ${id} not found`, StatusCodes.NOT_FOUND);
    }

    const allowed = STATUS_TRANSITIONS[existing.status];
    if (!allowed.includes(targetStatus)) {
      throw new DocumentServiceError(
        'INVALID_STATUS_TRANSITION',
        `Cannot transition from ${existing.status} to ${targetStatus}`,
        StatusCodes.UNPROCESSABLE_ENTITY,
      );
    }

    const updateData: Partial<IDocument> = {
      status: targetStatus,
      lastEditorId: userId,
    };

    if (targetStatus === DocumentStatus.PUBLISHED) {
      updateData.publishedAt = new Date();
    }

    const updated = await this.documentRepo.update(id, updateData);
    if (updated === null) {
      throw new DocumentServiceError('DOCUMENT_NOT_FOUND', `Document ${id} not found`, StatusCodes.NOT_FOUND);
    }

    if (targetStatus === DocumentStatus.PUBLISHED) {
      await this.publisher.publishDocumentPublished(updated);
    } else {
      await this.publisher.publishDocumentUpdated(updated);
    }

    logger.info('Document status transitioned', {
      documentId: id,
      from: existing.status,
      to: targetStatus,
      userId,
    });

    return toDto(updated);
  }

  async publishDocument(id: string, userId: string): Promise<DocumentResponseDto> {
    return this.transitionStatus(id, userId, DocumentStatus.PUBLISHED);
  }

  async archiveDocument(id: string, userId: string): Promise<DocumentResponseDto> {
    return this.transitionStatus(id, userId, DocumentStatus.ARCHIVED);
  }

  async submitForReview(id: string, userId: string): Promise<DocumentResponseDto> {
    return this.transitionStatus(id, userId, DocumentStatus.REVIEW);
  }

  async lockDocument(id: string, userId: string): Promise<DocumentResponseDto> {
    const locked = await this.documentRepo.lock(id, userId);
    if (locked === null) {
      // Either not found or locked by another user
      const existing = await this.documentRepo.findById(id);
      if (existing === null) {
        throw new DocumentServiceError('DOCUMENT_NOT_FOUND', `Document ${id} not found`, StatusCodes.NOT_FOUND);
      }
      throw new DocumentServiceError(
        'DOCUMENT_LOCKED',
        `Document is currently locked by another user`,
        StatusCodes.CONFLICT,
      );
    }

    logger.info('Document locked', { documentId: id, userId });

    return toDto(locked);
  }

  async unlockDocument(id: string, userId: string): Promise<DocumentResponseDto> {
    const unlocked = await this.documentRepo.unlock(id, userId);
    if (unlocked === null) {
      const existing = await this.documentRepo.findById(id);
      if (existing === null) {
        throw new DocumentServiceError('DOCUMENT_NOT_FOUND', `Document ${id} not found`, StatusCodes.NOT_FOUND);
      }
      throw new DocumentServiceError(
        'DOCUMENT_NOT_LOCKED_BY_USER',
        `Document is not locked by you`,
        StatusCodes.FORBIDDEN,
      );
    }

    logger.info('Document unlocked', { documentId: id, userId });

    return toDto(unlocked);
  }

  async searchDocuments(dto: SearchDocumentsDto): Promise<PaginatedResponseDto<DocumentResponseDto>> {
    if (dto.projectId === undefined) {
      throw new DocumentServiceError('VALIDATION_ERROR', 'projectId is required for search', StatusCodes.BAD_REQUEST);
    }

    const result = await this.documentRepo.search(dto.projectId, dto.query, {
      status: dto.status,
      limit: dto.limit,
      page: dto.page,
    });

    return {
      data: result.data.map(toDto),
      pagination: result.pagination,
    };
  }

  async getDocumentTree(projectId: string): Promise<DocumentTreeNodeDto[]> {
    return this.documentRepo.getTree(projectId);
  }
}
