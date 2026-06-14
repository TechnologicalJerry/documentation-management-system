import mongoose, { Schema, Model } from 'mongoose';

export interface IComment {
  _id: string;
  documentId: string;
  authorId: string;
  content: string;
  parentId?: string;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    documentId: {
      type: String,
      required: true,
      ref: 'Document',
      index: true,
    },
    authorId: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
    },
    parentId: {
      type: String,
      default: null,
      ref: 'Comment',
      comment: 'null = root comment; set to parent _id for threaded replies',
    },
    isResolved: {
      type: Boolean,
      default: false,
    },
    resolvedBy: {
      type: String,
    },
    resolvedAt: {
      type: Date,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// All active top-level comments on a document, chronological
CommentSchema.index({ documentId: 1, parentId: 1, createdAt: 1 });

// Filter out soft-deleted comments efficiently
CommentSchema.index({ deletedAt: 1 });

// Index for per-author lookup
CommentSchema.index({ authorId: 1 });

export const CommentModel: Model<IComment> = mongoose.model<IComment>('Comment', CommentSchema);
