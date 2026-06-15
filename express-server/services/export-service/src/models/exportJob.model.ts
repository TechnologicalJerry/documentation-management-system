import mongoose, { Document, Schema, Model } from 'mongoose';

// ──────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────

export enum ExportFormat {
  DOCX = 'DOCX',
  PDF = 'PDF',
  HTML = 'HTML',
  MARKDOWN = 'MARKDOWN',
  ZIP = 'ZIP',
}

export enum ExportStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// ──────────────────────────────────────────────────────────
// Interfaces
// ──────────────────────────────────────────────────────────

export interface ExportOptions {
  includeTableOfContents: boolean;
  includeMetadata: boolean;
  theme: 'default' | 'light' | 'dark' | 'professional';
  watermark?: string;
}

export interface IExportJob {
  id: string;
  userId: string;
  documentIds: string[];
  projectId?: string;
  format: ExportFormat;
  status: ExportStatus;
  outputPath?: string;
  outputSize?: number;
  downloadUrl?: string;
  expiresAt?: Date;
  error?: string;
  options: ExportOptions;
  processingTime?: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface IExportJobDocument extends IExportJob, Document {
  id: string;
}

// ──────────────────────────────────────────────────────────
// Schema
// ──────────────────────────────────────────────────────────

const ExportOptionsSchema = new Schema<ExportOptions>(
  {
    includeTableOfContents: { type: Boolean, default: false },
    includeMetadata: { type: Boolean, default: true },
    theme: {
      type: String,
      enum: ['default', 'light', 'dark', 'professional'],
      default: 'default',
    },
    watermark: { type: String, trim: true },
  },
  { _id: false },
);

const ExportJobSchema = new Schema<IExportJobDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    documentIds: {
      type: [String],
      required: true,
      validate: {
        validator: (ids: string[]) => ids.length > 0,
        message: 'At least one document ID is required',
      },
    },
    projectId: {
      type: String,
      index: true,
    },
    format: {
      type: String,
      enum: Object.values(ExportFormat),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ExportStatus),
      default: ExportStatus.PENDING,
      index: true,
    },
    outputPath: { type: String },
    outputSize: { type: Number, min: 0 },
    downloadUrl: { type: String },
    expiresAt: { type: Date, index: { expireAfterSeconds: 0 } },
    error: { type: String },
    options: {
      type: ExportOptionsSchema,
      default: () => ({
        includeTableOfContents: false,
        includeMetadata: true,
        theme: 'default',
      }),
    },
    processingTime: { type: Number, min: 0 },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        const anyRet = ret as any;
        anyRet.id = anyRet._id.toString();
        delete anyRet._id;

        return anyRet;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret) => {
        const anyRet = ret as any;
        anyRet.id = anyRet._id.toString();
        delete anyRet._id;

        return anyRet;
      },
    },
  },
);

// ──────────────────────────────────────────────────────────
// Indexes
// ──────────────────────────────────────────────────────────

ExportJobSchema.index({ userId: 1, createdAt: -1 });
ExportJobSchema.index({ userId: 1, status: 1 });
ExportJobSchema.index({ projectId: 1, createdAt: -1 });

// ──────────────────────────────────────────────────────────
// Model
// ──────────────────────────────────────────────────────────

export const ExportJobModel: Model<IExportJobDocument> = mongoose.model<IExportJobDocument>(
  'ExportJob',
  ExportJobSchema,
);
