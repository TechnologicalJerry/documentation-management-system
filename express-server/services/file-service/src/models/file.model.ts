import mongoose, { Schema, Document, Model } from 'mongoose';

export enum StorageProvider {
  LOCAL = 'LOCAL',
  S3 = 'S3',
}

export interface FileMetadata {
  width?: number;
  height?: number;
  duration?: number;
  pages?: number;
}

export interface IFile {
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
  uploaderId: string;
  projectId?: string;
  documentId?: string;
  isPublic: boolean;
  tags: string[];
  metadata: FileMetadata;
  thumbnailUrl?: string;
  storageProvider: StorageProvider;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileDocument extends IFile, Document {
  _id: mongoose.Types.ObjectId;
}

export interface FileModel extends Model<FileDocument> {
  findActiveById(id: string): Promise<FileDocument | null>;
}

const fileMetadataSchema = new Schema<FileMetadata>(
  {
    width: { type: Number },
    height: { type: Number },
    duration: { type: Number },
    pages: { type: Number },
  },
  { _id: false },
);

const fileSchema = new Schema<FileDocument>(
  {
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 512,
    },
    filename: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    path: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    uploaderId: {
      type: String,
      required: true,
      index: true,
    },
    projectId: {
      type: String,
      index: true,
    },
    documentId: {
      type: String,
      index: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    metadata: {
      type: fileMetadataSchema,
      default: () => ({}),
    },
    thumbnailUrl: {
      type: String,
      trim: true,
    },
    storageProvider: {
      type: String,
      enum: Object.values(StorageProvider),
      required: true,
      default: StorageProvider.LOCAL,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        const anyRet = ret as any;
        anyRet.id = String(anyRet._id);
        delete anyRet._id;

        return anyRet;
      },
    },
    toObject: {
      virtuals: true,
    },
  },
);

fileSchema.index({ uploaderId: 1, isDeleted: 1 });
fileSchema.index({ projectId: 1, isDeleted: 1 });
fileSchema.index({ documentId: 1, isDeleted: 1 });
fileSchema.index({ mimeType: 1, isDeleted: 1 });
fileSchema.index({ createdAt: -1 });
fileSchema.index({ tags: 1, isDeleted: 1 });

fileSchema.statics.findActiveById = function (id: string): Promise<FileDocument | null> {
  return (this as FileModel).findOne({ _id: id, isDeleted: false }).exec();
};

export const FileModel = mongoose.model<FileDocument, FileModel>('File', fileSchema);
