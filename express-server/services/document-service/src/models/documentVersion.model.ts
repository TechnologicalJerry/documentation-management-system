import mongoose, { Schema, Model } from 'mongoose';

export interface IDocumentVersion {
  _id: string;
  documentId: string;
  version: number;
  title: string;
  content: string;
  contentHtml?: string;
  editorId: string;
  changeDescription?: string;
  diff?: string;
  createdAt: Date;
}

const DocumentVersionSchema = new Schema<IDocumentVersion>(
  {
    documentId: {
      type: String,
      required: true,
      ref: 'Document',
    },
    version: {
      type: Number,
      required: true,
      min: 1,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    content: {
      type: String,
      default: '',
    },
    contentHtml: {
      type: String,
    },
    editorId: {
      type: String,
      required: true,
    },
    changeDescription: {
      type: String,
      maxlength: 1000,
    },
    diff: {
      type: String,
      comment: 'JSON-encoded diff between this version and the previous one',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

// Primary lookup: all versions for a document, newest first
DocumentVersionSchema.index({ documentId: 1, version: -1 });

// Unique constraint: document can only have one entry per version number
DocumentVersionSchema.index({ documentId: 1, version: 1 }, { unique: true });

// Index for editor lookups
DocumentVersionSchema.index({ editorId: 1 });

export const DocumentVersionModel: Model<IDocumentVersion> =
  mongoose.model<IDocumentVersion>('DocumentVersion', DocumentVersionSchema);
