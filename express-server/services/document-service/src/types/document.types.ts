import { DocumentStatus, DocumentType } from '../models/document.model';

// ─── Request DTOs ────────────────────────────────────────────────────────────

export interface CreateDocumentDto {
  title: string;
  content?: string;
  contentHtml?: string;
  excerpt?: string;
  type?: DocumentType;
  parentId?: string;
  order?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  isPublic?: boolean;
}

export interface UpdateDocumentDto {
  title?: string;
  content?: string;
  contentHtml?: string;
  excerpt?: string;
  type?: DocumentType;
  parentId?: string;
  order?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  isPublic?: boolean;
  changeDescription?: string;
}

export interface DocumentQueryDto {
  status?: DocumentStatus;
  type?: DocumentType;
  tags?: string | string[];
  authorId?: string;
  isPublic?: boolean;
  parentId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeDeleted?: boolean;
}

export interface SearchDocumentsDto {
  query: string;
  projectId?: string;
  status?: DocumentStatus;
  tags?: string[];
  page?: number;
  limit?: number;
}

// ─── Comment DTOs ────────────────────────────────────────────────────────────

export interface CreateCommentDto {
  content: string;
  parentId?: string;
}

export interface UpdateCommentDto {
  content: string;
}

// ─── Response DTOs ───────────────────────────────────────────────────────────

export interface DocumentResponseDto {
  id: string;
  title: string;
  slug: string;
  content: string;
  contentHtml?: string;
  excerpt?: string;
  status: DocumentStatus;
  type: DocumentType;
  projectId: string;
  authorId: string;
  lastEditorId: string;
  parentId?: string;
  order: number;
  tags: string[];
  metadata: Record<string, unknown>;
  isPublic: boolean;
  lockedBy?: string;
  lockedAt?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersionResponseDto {
  id: string;
  documentId: string;
  version: number;
  title: string;
  content: string;
  contentHtml?: string;
  editorId: string;
  changeDescription?: string;
  createdAt: string;
}

export interface CommentResponseDto {
  id: string;
  documentId: string;
  authorId: string;
  content: string;
  parentId?: string;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponseDto<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface VersionDiffResponseDto {
  documentId: string;
  fromVersion: number;
  toVersion: number;
  fromContent: string;
  toContent: string;
  diff: string;
}

export interface DocumentTreeNodeDto {
  id: string;
  title: string;
  slug: string;
  status: DocumentStatus;
  type: DocumentType;
  order: number;
  parentId?: string;
  children: DocumentTreeNodeDto[];
}

// ─── Service-layer error types ───────────────────────────────────────────────

export type DocumentErrorCode =
  | 'DOCUMENT_NOT_FOUND'
  | 'DOCUMENT_ALREADY_EXISTS'
  | 'DOCUMENT_LOCKED'
  | 'DOCUMENT_NOT_LOCKED_BY_USER'
  | 'DOCUMENT_DELETED'
  | 'INVALID_STATUS_TRANSITION'
  | 'COMMENT_NOT_FOUND'
  | 'COMMENT_NOT_AUTHOR'
  | 'VERSION_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'VALIDATION_ERROR';

export class DocumentServiceError extends Error {
  constructor(
    public readonly code: DocumentErrorCode,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'DocumentServiceError';
    Object.setPrototypeOf(this, DocumentServiceError.prototype);
  }
}
