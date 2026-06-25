export enum DocumentStatus {
  DRAFT = 'DRAFT',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

export enum DocumentType {
  MARKDOWN = 'MARKDOWN',
  RICH_TEXT = 'RICH_TEXT',
  API_REFERENCE = 'API_REFERENCE',
  TUTORIAL = 'TUTORIAL',
  GUIDE = 'GUIDE',
  CHANGELOG = 'CHANGELOG',
  FAQ = 'FAQ',
  GLOSSARY = 'GLOSSARY',
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  title: string;
  content: string;
  contentHash: string;
  authorId: string;
  changeDescription?: string;
  createdAt: Date;
}

export interface DocumentComment {
  id: string;
  documentId: string;
  authorId: string;
  content: string;
  parentCommentId?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  title: string;
  slug: string;
  content: string;
  contentType: DocumentType;
  status: DocumentStatus;
  projectId: string;
  authorId: string;
  collaboratorIds: string[];
  currentVersionId?: string;
  versionCount: number;
  tags: string[];
  metadata: DocumentMetadata;
  publishedAt?: Date;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentMetadata {
  wordCount: number;
  readingTimeMinutes: number;
  excerpt?: string;
  coverImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  customFields: Record<string, unknown>;
}

export interface CreateDocumentRequest {
  title: string;
  content?: string;
  contentType?: DocumentType;
  projectId: string;
  tags?: string[];
  metadata?: Partial<DocumentMetadata>;
}

export interface UpdateDocumentRequest {
  title?: string;
  content?: string;
  contentType?: DocumentType;
  status?: DocumentStatus;
  tags?: string[];
  metadata?: Partial<DocumentMetadata>;
  changeDescription?: string;
}

export interface PublishDocumentRequest {
  scheduledAt?: Date;
  notifySubscribers?: boolean;
}
