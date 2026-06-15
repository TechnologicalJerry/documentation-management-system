import fs from 'fs';
import path from 'path';
import fse from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import {
  ExportJobModel,
  IExportJob,
  IExportJobDocument,
  ExportFormat,
  ExportStatus,
} from '../models/exportJob.model';
import { ExporterFactory } from '../exporters/exporter.factory';
import { ZipExporter } from '../exporters/zip.exporter';
import { DocumentFetcherService } from './documentFetcher.service';
import { ExportRequestDto, ExportQueryDto } from '../validators/export.validators';
import { config } from '../config';
import { logger } from '../lib/logger';

// ── Interfaces ─────────────────────────────────────────────

export interface PaginatedExportJobs {
  data: IExportJob[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface IExportService {
  requestExport(userId: string, dto: ExportRequestDto, token: string): Promise<IExportJob>;
  getExportJob(id: string, userId: string): Promise<IExportJob>;
  getExportJobs(userId: string, query: ExportQueryDto): Promise<PaginatedExportJobs>;
  processExport(jobId: string, token: string): Promise<void>;
  downloadExport(id: string, userId: string): Promise<{ stream: fs.ReadStream; mimeType: string; filename: string }>;
  deleteExportJob(id: string, userId: string): Promise<void>;
}

// ── Service implementation ─────────────────────────────────

export class ExportService implements IExportService {
  private readonly documentFetcher: DocumentFetcherService;
  private readonly storagePath: string;
  private readonly expiryHours: number;

  constructor() {
    this.documentFetcher = new DocumentFetcherService();
    this.storagePath = config.export.storagePath;
    this.expiryHours = config.export.expiryHours;
    void fse.ensureDir(this.storagePath);
  }

  /**
   * Create an export job and enqueue it for async processing.
   * Returns immediately with the job record (status = PENDING).
   */
  async requestExport(
    userId: string,
    dto: ExportRequestDto,
    _token: string,
  ): Promise<IExportJob> {
    logger.info('Creating export job', { userId, format: dto.format, docCount: dto.documentIds.length });

    const job = await ExportJobModel.create({
      userId,
      documentIds: dto.documentIds,
      projectId: dto.projectId,
      format: dto.format,
      status: ExportStatus.PENDING,
      options: dto.options,
    });

    logger.info('Export job created', { jobId: job.id, userId });

    return job.toObject();
  }

  /**
   * Get a specific export job (scoped to userId).
   */
  async getExportJob(id: string, userId: string): Promise<IExportJob> {
    const job = await ExportJobModel.findOne({ _id: id, userId }).lean();
    if (!job) {
      throw new NotFoundError(`Export job not found: ${id}`);
    }

    return job;
  }

  /**
   * List export jobs for a user with pagination and filtering.
   */
  async getExportJobs(userId: string, query: ExportQueryDto): Promise<PaginatedExportJobs> {
    const { page, limit, status, format, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { userId };
    if (status) {filter['status'] = status;}
    if (format != null) {filter['format'] = format;}

    const sortDir = sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortBy]: sortDir };

    const [data, total] = await Promise.all([
      ExportJobModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      ExportJobModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Internal: actually run the export and update the job record.
   * Should be called from the worker or inline (for sync tests).
   */
  async processExport(jobId: string, token: string): Promise<void> {
    const startTime = Date.now();

    // Mark as PROCESSING
    const job = await ExportJobModel.findByIdAndUpdate(
      jobId,
      { status: ExportStatus.PROCESSING },
      { new: true },
    );

    if (!job) {
      throw new NotFoundError(`Export job not found: ${jobId}`);
    }

    logger.info('Processing export job', {
      jobId,
      userId: job.userId,
      format: job.format,
      docCount: job.documentIds.length,
    });

    try {
      let outputBuffer: Buffer;
      const isBatch = job.documentIds.length > 1 || job.format === ExportFormat.ZIP;

      if (isBatch || job.format === ExportFormat.ZIP) {
        // Batch / ZIP export
        const documents = await this.documentFetcher.fetchDocumentsByIds(
          job.documentIds,
          token,
        );

        const zipExporter = new ZipExporter();
        // For ZIP format, use the first non-ZIP format; default to MARKDOWN
        const innerFormat =
          job.format === ExportFormat.ZIP ? ExportFormat.MARKDOWN : job.format;

        outputBuffer = await zipExporter.exportMultiple(documents, innerFormat, job.options);
        job.format = ExportFormat.ZIP; // Ensure format is set to ZIP
      } else {
        // Single document export
        const document = await this.documentFetcher.fetchDocument(job.documentIds[0], token);
        const exporter = ExporterFactory.createExporter(job.format);
        outputBuffer = await exporter.export(document, job.options);
      }

      // Validate size
      const maxBytes = config.export.maxSizeMb * 1024 * 1024;
      if (outputBuffer.length > maxBytes) {
        throw new Error(
          `Export exceeds maximum size of ${config.export.maxSizeMb}MB (got ${Math.round(outputBuffer.length / 1024 / 1024)}MB)`,
        );
      }

      // Write to disk
      const filename = this.buildFilename(job);
      const outputPath = path.join(this.storagePath, filename);
      await fse.ensureDir(this.storagePath);
      await fse.writeFile(outputPath, outputBuffer);

      // Calculate expiry
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.expiryHours);

      const processingTime = Date.now() - startTime;

      await ExportJobModel.findByIdAndUpdate(jobId, {
        status: ExportStatus.COMPLETED,
        outputPath,
        outputSize: outputBuffer.length,
        downloadUrl: `/export/${job.id}/download`,
        expiresAt,
        processingTime,
        completedAt: new Date(),
      });

      logger.info('Export job completed', { jobId, processingTime, outputSize: outputBuffer.length });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Export job failed', { jobId, error: err.message });

      await ExportJobModel.findByIdAndUpdate(jobId, {
        status: ExportStatus.FAILED,
        error: err.message,
        processingTime: Date.now() - startTime,
      });

      throw err;
    }
  }

  /**
   * Return a readable file stream for downloading a completed export.
   */
  async downloadExport(
    id: string,
    userId: string,
  ): Promise<{ stream: fs.ReadStream; mimeType: string; filename: string }> {
    const job = await ExportJobModel.findOne({ _id: id, userId }).lean();

    if (!job) {
      throw new NotFoundError(`Export job not found: ${id}`);
    }
    if (job.status !== ExportStatus.COMPLETED) {
      throw new ExportNotReadyError(
        `Export is not ready. Current status: ${job.status}`,
      );
    }
    if (!job.outputPath) {
      throw new Error('Output path not available for completed job');
    }

    // Check file still exists (may have been cleaned up)
    if (!fs.existsSync(job.outputPath)) {
      throw new ExportExpiredError('Export file has expired or been deleted');
    }

    if (job.expiresAt && new Date() > job.expiresAt) {
      throw new ExportExpiredError('Export has expired');
    }

    const mimeType = ExporterFactory.getMimeType(job.format);
    const extension = ExporterFactory.getFileExtension(job.format);
    const safeTitle = job.outputPath
      ? path.basename(job.outputPath)
      : `export_${id}.${extension}`;

    return {
      stream: fs.createReadStream(job.outputPath),
      mimeType,
      filename: safeTitle,
    };
  }

  /**
   * Delete an export job and its output file.
   */
  async deleteExportJob(id: string, userId: string): Promise<void> {
    const job = await ExportJobModel.findOne({ _id: id, userId }).lean();
    if (!job) {
      throw new NotFoundError(`Export job not found: ${id}`);
    }

    // Remove output file if present
    if (job.outputPath && fs.existsSync(job.outputPath)) {
      await fse.remove(job.outputPath);
    }

    await ExportJobModel.deleteOne({ _id: id });
    logger.info('Export job deleted', { jobId: id, userId });
  }

  /**
   * Clean up expired export files and job records.
   */
  async cleanupExpiredExports(): Promise<number> {
    const now = new Date();
    const expiredJobs = await ExportJobModel.find({
      expiresAt: { $lt: now },
      status: ExportStatus.COMPLETED,
    }).lean();

    let cleaned = 0;
    for (const job of expiredJobs) {
      if (job.outputPath && fs.existsSync(job.outputPath)) {
        await fse.remove(job.outputPath);
        cleaned++;
      }
    }

    await ExportJobModel.deleteMany({ expiresAt: { $lt: now }, status: ExportStatus.COMPLETED });
    logger.info(`Cleaned up ${cleaned} expired export files, ${expiredJobs.length} job records`);

    return expiredJobs.length;
  }

  // ── Private helpers ────────────────────────────────────

  private buildFilename(job: IExportJobDocument): string {
    const ext = ExporterFactory.getFileExtension(job.format);
    const unique = uuidv4().slice(0, 8);

    return `export_${unique}.${ext}`;
  }
}

// ── Custom errors ─────────────────────────────────────────

export class NotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ExportNotReadyError extends Error {
  readonly statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ExportNotReadyError';
  }
}

export class ExportExpiredError extends Error {
  readonly statusCode = 410;
  constructor(message: string) {
    super(message);
    this.name = 'ExportExpiredError';
  }
}
