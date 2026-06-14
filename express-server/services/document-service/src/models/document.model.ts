import mongoose, { Schema, Model } from 'mongoose';

export enum DocumentStatus {
  DRAFT = 'DRAFT',
  REVIEW = 'REVIEW',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum DocumentType {
  README = 'README',
  API = 'API',
  GUIDE = 'GUIDE',
  TUTORIAL = 'TUTORIAL',
  REFERENCE = 'REFERENCE',
  CHANGELOG = 'CHANGELOG',
  CUSTOM = 'CUSTOM',
}

export interface IDocument {
  _id: string;
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
  lockedAt?: Date;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const DocumentSchema = new Schema<IDocument>(
  {
    title: { type: String, required: true, trim: true, maxlength: 500 },
    slug: { type: String, required: true, trim: true, lowercase: true },
    content: { type: String, default: '' },
    contentHtml: { type: String },
    excerpt: { type: String, maxlength: 500 },
    status: {
      type: String,
      enum: Object.values(DocumentStatus),
      default: DocumentStatus.DRAFT,
    },
    type: {
      type: String,
      enum: Object.values(DocumentType),
      default: DocumentType.CUSTOM,
    },
    projectId: { type: String, required: true, index: true },
    authorId: { type: String, required: true },
    lastEditorId: { type: String, required: true },
    parentId: { type: String, default: null },
    order: { type: Number, default: 0 },
    tags: [{ type: String, trim: true, lowercase: true }],
    metadata: { type: Schema.Types.Mixed, default: {} },
    isPublic: { type: Boolean, default: false },
    lockedBy: { type: String },
    lockedAt: { type: Date },
    publishedAt: { type: Date },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Compound unique index: slug must be unique per project for active documents
DocumentSchema.index(
  { projectId: 1, slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

// Compound index for status-based project queries
DocumentSchema.index({ projectId: 1, status: 1 });

// Index for author lookups
DocumentSchema.index({ authorId: 1 });

// Index for hierarchical tree queries
DocumentSchema.index({ projectId: 1, parentId: 1, order: 1 });

// Index for tag filtering
DocumentSchema.index({ projectId: 1, tags: 1 });

// Index for soft-delete filtering
DocumentSchema.index({ deletedAt: 1 });

// Full-text search index on title and content
DocumentSchema.index({ title: 'text', content: 'text', tags: 'text' });

export const DocumentModel: Model<IDocument> = mongoose.model<IDocument>(
  'Document',
  DocumentSchema,
);
