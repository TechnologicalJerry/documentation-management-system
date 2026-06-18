import path from 'path';
import { ReadStream } from 'fs';
import sharp from 'sharp';
import { nanoid } from 'nanoid';
import mime from 'mime-types';
import { FileDocument, FileModel, StorageProvider } from '../models/file.model';
import { StorageFactory, isS3Storage } from '../storage/storage.factory';
import { IStorage } from '../types/storage.types';
import {
  FileQuery,
  PaginatedResult,
  UploadFileOptions,
  UpdateFileMetadataPayload,
  MulterFile,
} from '../types/file.types';
import { config } from '../config';
import { logger } from '../lib/logger';

export interface IFileService {
  uploadFile(
    uploaderId: string,
    file: MulterFile,
    options?: UploadFileOptions,
  ): Promise<FileDocument>;
  uploadMultipleFiles(
    uploaderId: string,
    files: MulterFile[],
    options?: UploadFileOptions,
  ): Promise<FileDocument[]>;
  getFile(id: string): Promise<FileDocument>;
  getFiles(query: FileQuery): Promise<PaginatedResult<FileDocument>>;
  deleteFile(id: string, userId: string): Promise<void>;
  generateThumbnail(fileId: string): Promise<string>;
  getFileStream(id: string): Promise<ReadStream>;
  updateFileMetadata(id: string, payload: UpdateFileMetadataPayload): Promise<FileDocument>;
}

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/tiff',
]);

export class FileService implements IFileService {
  private readonly storage: IStorage;

  constructor(storage?: IStorage) {
    this.storage = storage ?? StorageFactory.getInstance();
  }

  private generateStorageFilename(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    const id = nanoid(21);

    return `${id}${ext}`;
  }

  private buildStorageProvider(): StorageProvider {
    return config.storage.provider === 's3' ? StorageProvider.S3 : StorageProvider.LOCAL;
  }

  private isImage(mimeType: string): boolean {
    return IMAGE_MIME_TYPES.has(mimeType);
  }

  private async extractImageMetadata(
    buffer: Buffer,
  ): Promise<{ width?: number; height?: number }> {
    try {
      const metadata = await sharp(buffer).metadata();

      return { width: metadata.width, height: metadata.height };
    } catch {
      return {};
    }
  }

  async uploadFile(
    uploaderId: string,
    file: MulterFile,
    options: UploadFileOptions = {},
  ): Promise<FileDocument> {
    const filename = this.generateStorageFilename(file.originalname);
    logger.info('Uploading file', {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploaderId,
    });

    const storageResult = await this.storage.save(file.buffer, filename, file.mimetype);

    let metadata: { width?: number; height?: number } = {};
    if (this.isImage(file.mimetype)) {
      metadata = await this.extractImageMetadata(file.buffer);
    }

    const fileDoc = await FileModel.create({
      originalName: file.originalname,
      filename,
      mimeType: file.mimetype,
      size: storageResult.size,
      path: storageResult.path,
      url: storageResult.url,
      uploaderId,
      projectId: options.projectId,
      documentId: options.documentId,
      isPublic: options.isPublic ?? false,
      tags: options.tags ?? [],
      metadata,
      storageProvider: this.buildStorageProvider(),
      isDeleted: false,
    });

    logger.info('File uploaded successfully', { fileId: String(fileDoc._id), filename });

    return fileDoc;
  }

  async uploadMultipleFiles(
    uploaderId: string,
    files: MulterFile[],
    options: UploadFileOptions = {},
  ): Promise<FileDocument[]> {
    const results = await Promise.all(
      files.map((file) => this.uploadFile(uploaderId, file, options)),
    );

    return results;
  }

  async getFile(id: string): Promise<FileDocument> {
    const file = await FileModel.findActiveById(id);
    if (file === null) {
      throw new NotFoundError(`File not found: ${id}`);
    }

    return file;
  }

  async getFiles(query: FileQuery): Promise<PaginatedResult<FileDocument>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(
      query.limit ?? config.pagination.defaultPageSize,
      config.pagination.maxPageSize,
    );
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { isDeleted: false };

    if (query.projectId !== undefined && query.projectId !== '') {
      filter['projectId'] = query.projectId;
    }

    if (query.documentId !== undefined && query.documentId !== '') {
      filter['documentId'] = query.documentId;
    }

    if (query.uploaderId !== undefined && query.uploaderId !== '') {
      filter['uploaderId'] = query.uploaderId;
    }

    if (query.mimeType !== undefined && query.mimeType !== '') {
      filter['mimeType'] = { $regex: query.mimeType, $options: 'i' };
    }

    if (query.isPublic !== undefined) {
      filter['isPublic'] = query.isPublic;
    }

    if (query.tags !== undefined && query.tags.length > 0) {
      filter['tags'] = { $in: query.tags };
    }

    if (query.search !== undefined && query.search !== '') {
      filter['originalName'] = { $regex: query.search, $options: 'i' };
    }

    const [data, total] = await Promise.all([
      FileModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      FileModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async deleteFile(id: string, userId: string): Promise<void> {
    const file = await FileModel.findActiveById(id);
    if (file === null) {
      throw new NotFoundError(`File not found: ${id}`);
    }

    logger.info('Deleting file', { fileId: id, userId, filename: file.filename });

    // Soft-delete the record first so a failed storage delete doesn't corrupt state
    await FileModel.findByIdAndUpdate(id, { isDeleted: true }).exec();

    try {
      await this.storage.delete(file.path);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Storage deletion failed; record already soft-deleted', {
        fileId: id,
        error: err.message,
      });
    }

    // Delete thumbnail if present
    if (file.thumbnailUrl !== undefined && file.thumbnailUrl !== '') {
      const thumbFilename = `thumb_${file.filename}`;
      const thumbPath =
        config.storage.provider === 'local'
          ? path.join(config.storage.localPath, thumbFilename)
          : thumbFilename;

      try {
        await this.storage.delete(thumbPath);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.warn('Failed to delete thumbnail', { thumbPath, error: err.message });
      }
    }

    logger.info('File deleted', { fileId: id });
  }

  async generateThumbnail(fileId: string): Promise<string> {
    const file = await FileModel.findActiveById(fileId);
    if (file === null) {
      throw new NotFoundError(`File not found: ${fileId}`);
    }

    if (!this.isImage(file.mimeType)) {
      throw new ValidationError(`Thumbnails can only be generated for images, got: ${file.mimeType}`);
    }

    if (file.thumbnailUrl !== undefined && file.thumbnailUrl !== '') {
      return file.thumbnailUrl;
    }

    logger.info('Generating thumbnail', { fileId, filename: file.filename });

    const stream = this.storage.getStream(file.path);
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer | string) => chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
      stream.on('end', () => resolve());
      stream.on('error', (err: Error) => reject(err));
    });

    const originalBuffer = Buffer.concat(chunks);

    const thumbnailBuffer = await sharp(originalBuffer)
      .resize(config.thumbnail.width, config.thumbnail.height, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: config.thumbnail.quality })
      .toBuffer();

    const thumbExt = mime.extension('image/jpeg');
    const thumbFilename = `thumb_${path.parse(file.filename).name}.${thumbExt !== false ? thumbExt : 'jpg'}`;

    const thumbResult = await this.storage.save(thumbnailBuffer, thumbFilename, 'image/jpeg');

    const updatedFile = await FileModel.findByIdAndUpdate(
      fileId,
      {
        thumbnailUrl: thumbResult.url,
        'metadata.width': (await sharp(originalBuffer).metadata()).width,
        'metadata.height': (await sharp(originalBuffer).metadata()).height,
      },
      { new: true },
    ).exec();

    if (updatedFile === null) {
      throw new NotFoundError(`File record disappeared during thumbnail generation: ${fileId}`);
    }

    logger.info('Thumbnail generated', { fileId, thumbnailUrl: thumbResult.url });

    return thumbResult.url;
  }

  async getFileStream(id: string): Promise<ReadStream> {
    const file = await FileModel.findActiveById(id);
    if (file === null) {
      throw new NotFoundError(`File not found: ${id}`);
    }

    return this.storage.getStream(file.path);
  }

  async updateFileMetadata(id: string, payload: UpdateFileMetadataPayload): Promise<FileDocument> {
    const file = await FileModel.findActiveById(id);
    if (file === null) {
      throw new NotFoundError(`File not found: ${id}`);
    }

    const updates: Partial<FileDocument> = {};

    if (payload.originalName !== undefined) {
      updates.originalName = payload.originalName;
    }

    if (payload.isPublic !== undefined) {
      updates.isPublic = payload.isPublic;
    }

    if (payload.tags !== undefined) {
      updates.tags = payload.tags;
    }

    if (payload.projectId !== undefined) {
      updates.projectId = payload.projectId;
    }

    if (payload.documentId !== undefined) {
      updates.documentId = payload.documentId;
    }

    const updated = await FileModel.findByIdAndUpdate(id, updates, { new: true }).exec();

    if (updated === null) {
      throw new NotFoundError(`File not found after update: ${id}`);
    }

    logger.info('File metadata updated', { fileId: id });

    return updated;
  }

  async getSignedUrl(id: string, expiresIn: number = 3600): Promise<string> {
    const file = await FileModel.findActiveById(id);
    if (file === null) {
      throw new NotFoundError(`File not found: ${id}`);
    }

    if (!isS3Storage(this.storage)) {
      return file.url;
    }

    return this.storage.getSignedUrl(file.path, expiresIn);
  }
}

// ---- Domain Errors ----

export class NotFoundError extends Error {
  readonly statusCode = 404;

  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ForbiddenError extends Error {
  readonly statusCode = 403;

  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}
