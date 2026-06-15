import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import { ExportService, NotFoundError, ExportNotReadyError, ExportExpiredError } from '../services/export.service';
import { ExportWorker } from '../workers/export.worker';
import {
  ExportRequestDtoSchema,
  ExportQueryDtoSchema,
} from '../validators/export.validators';
import { logger } from '../lib/logger';

// ── Auth helper (extracts user id from JWT claims added by middleware) ──

function getUserId(req: Request): string {
  const user = req.user as { id?: string; sub?: string } | undefined;
  const userId = user?.id ?? user?.sub;
  if (!userId) {throw new Error('Unauthenticated: no user in request');}

  return userId;
}

function getToken(req: Request): string {
  const auth = req.headers.authorization ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) {throw new Error('Unauthenticated: no bearer token');}

  return token;
}

// ──────────────────────────────────────────────────────────

export class ExportController {
  private readonly exportService: ExportService;
  private readonly exportWorker: ExportWorker;

  constructor() {
    this.exportService = new ExportService();
    this.exportWorker = new ExportWorker(this.exportService);
  }

  // ── POST /export ───────────────────────────────────────

  requestExport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const token = getToken(req);
      const dto = ExportRequestDtoSchema.parse(req.body);

      const job = await this.exportService.requestExport(userId, dto, token);

      // Kick off async processing (fire-and-forget)
      void this.exportWorker.enqueue(job.id.toString(), token);

      res.status(StatusCodes.ACCEPTED).json({
        success: true,
        message: 'Export job created and queued for processing',
        data: job,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  // ── GET /export/:id ────────────────────────────────────

  getExportJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;

      const job = await this.exportService.getExportJob(id, userId);

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Export job retrieved',
        data: job,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  // ── GET /export ────────────────────────────────────────

  listExportJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const query = ExportQueryDtoSchema.parse(req.query);

      const result = await this.exportService.getExportJobs(userId, query);

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Export jobs retrieved',
        data: result.data,
        meta: result.meta,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  // ── GET /export/:id/download ───────────────────────────

  downloadExport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;

      const { stream, mimeType, filename } = await this.exportService.downloadExport(id, userId);

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-store');

      stream.on('error', (err) => {
        logger.error('Stream error during download', { jobId: id, error: err.message });
        if (!res.headersSent) {
          next(err);
        }
      });

      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  };

  // ── DELETE /export/:id ─────────────────────────────────

  deleteExportJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;

      await this.exportService.deleteExportJob(id, userId);

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Export job deleted',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}

// ── Global error handler for export routes ─────────────────

export function exportErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof ZodError) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      success: false,
      message: 'Validation failed',
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.flatten(),
      },
      timestamp: new Date().toISOString(),
    });

    return;
  }

  if (error instanceof NotFoundError) {
    res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: error.message,
      error: { code: 'NOT_FOUND', message: error.message },
      timestamp: new Date().toISOString(),
    });

    return;
  }

  if (error instanceof ExportNotReadyError) {
    res.status(StatusCodes.CONFLICT).json({
      success: false,
      message: error.message,
      error: { code: 'EXPORT_NOT_READY', message: error.message },
      timestamp: new Date().toISOString(),
    });

    return;
  }

  if (error instanceof ExportExpiredError) {
    res.status(StatusCodes.GONE).json({
      success: false,
      message: error.message,
      error: { code: 'EXPORT_EXPIRED', message: error.message },
      timestamp: new Date().toISOString(),
    });

    return;
  }

  const err = error instanceof Error ? error : new Error(String(error));
  logger.error('Unhandled controller error', { error: err.message, stack: err.stack });

  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: 'Internal server error',
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    timestamp: new Date().toISOString(),
  });
}
