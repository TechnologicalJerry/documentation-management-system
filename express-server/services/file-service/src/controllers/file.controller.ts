import { Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthenticatedRequest, MulterFile } from '../types/file.types';
import { FileService, NotFoundError, ValidationError } from '../services/file.service';
import {
  uploadOptionsSchema,
  fileQuerySchema,
  updateFileMetadataSchema,
  mongoIdSchema,
} from '../validators/file.validators';
import { logger } from '../lib/logger';

export class FileController {
  private readonly fileService: FileService;

  constructor(fileService?: FileService) {
    this.fileService = fileService ?? new FileService();
  }

  /**
   * POST /files/upload
   * Upload a single file
   */
  uploadFile = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (req.user === undefined) {
        res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });

        return;
      }

      const file = req.file as MulterFile | undefined;
      if (file === undefined) {
        res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'No file provided' });

        return;
      }

      const optionsResult = uploadOptionsSchema.safeParse(req.body);
      if (!optionsResult.success) {
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'Invalid upload options',
          errors: optionsResult.error.flatten().fieldErrors,
        });

        return;
      }

      const fileDoc = await this.fileService.uploadFile(req.user.sub, file, optionsResult.data);

      res.status(StatusCodes.CREATED).json({
        success: true,
        data: fileDoc,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /files/upload/multiple
   * Upload multiple files (up to 10)
   */
  uploadMultipleFiles = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (req.user === undefined) {
        res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });

        return;
      }

      const files = req.files as MulterFile[] | undefined;
      if (files === undefined || files.length === 0) {
        res
          .status(StatusCodes.BAD_REQUEST)
          .json({ success: false, message: 'No files provided' });

        return;
      }

      const optionsResult = uploadOptionsSchema.safeParse(req.body);
      if (!optionsResult.success) {
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'Invalid upload options',
          errors: optionsResult.error.flatten().fieldErrors,
        });

        return;
      }

      const fileDocs = await this.fileService.uploadMultipleFiles(
        req.user.sub,
        files,
        optionsResult.data,
      );

      res.status(StatusCodes.CREATED).json({
        success: true,
        data: fileDocs,
        count: fileDocs.length,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /files/:id
   * Get file metadata
   */
  getFile = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const idResult = mongoIdSchema.safeParse(req.params['id']);
      if (!idResult.success) {
        res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Invalid file ID' });

        return;
      }

      const file = await this.fileService.getFile(idResult.data);

      if (!file.isPublic && req.user === undefined) {
        res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });

        return;
      }

      res.status(StatusCodes.OK).json({ success: true, data: file });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /files/:id/download
   * Download file as attachment
   */
  downloadFile = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const idResult = mongoIdSchema.safeParse(req.params['id']);
      if (!idResult.success) {
        res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Invalid file ID' });

        return;
      }

      const file = await this.fileService.getFile(idResult.data);

      if (!file.isPublic && req.user === undefined) {
        res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });

        return;
      }

      const stream = await this.fileService.getFileStream(idResult.data);

      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Length', String(file.size));
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(file.originalName)}"`,
      );
      res.setHeader('Cache-Control', 'private, max-age=86400');

      stream.on('error', (err: Error) => {
        logger.error('Stream error during download', { fileId: idResult.data, error: err.message });
        if (!res.headersSent) {
          res
            .status(StatusCodes.INTERNAL_SERVER_ERROR)
            .json({ success: false, message: 'File stream error' });
        }
      });

      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /files/:id/stream
   * Stream file inline (for media playback, preview)
   */
  streamFile = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const idResult = mongoIdSchema.safeParse(req.params['id']);
      if (!idResult.success) {
        res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Invalid file ID' });

        return;
      }

      const file = await this.fileService.getFile(idResult.data);

      if (!file.isPublic && req.user === undefined) {
        res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });

        return;
      }

      const stream = await this.fileService.getFileStream(idResult.data);

      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Length', String(file.size));
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(file.originalName)}"`,
      );
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      stream.on('error', (err: Error) => {
        logger.error('Stream error during inline streaming', {
          fileId: idResult.data,
          error: err.message,
        });
        if (!res.headersSent) {
          res
            .status(StatusCodes.INTERNAL_SERVER_ERROR)
            .json({ success: false, message: 'File stream error' });
        }
      });

      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /files/:id
   * Soft-delete a file
   */
  deleteFile = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (req.user === undefined) {
        res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });

        return;
      }

      const idResult = mongoIdSchema.safeParse(req.params['id']);
      if (!idResult.success) {
        res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Invalid file ID' });

        return;
      }

      await this.fileService.deleteFile(idResult.data, req.user.sub);

      res.status(StatusCodes.OK).json({ success: true, message: 'File deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /files
   * List files with filters and pagination
   */
  listFiles = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (req.user === undefined) {
        res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });

        return;
      }

      const queryResult = fileQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'Invalid query parameters',
          errors: queryResult.error.flatten().fieldErrors,
        });

        return;
      }

      const result = await this.fileService.getFiles(queryResult.data);

      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /files/:id
   * Update file metadata
   */
  updateFileMetadata = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (req.user === undefined) {
        res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });

        return;
      }

      const idResult = mongoIdSchema.safeParse(req.params['id']);
      if (!idResult.success) {
        res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Invalid file ID' });

        return;
      }

      const bodyResult = updateFileMetadataSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'Invalid metadata',
          errors: bodyResult.error.flatten().fieldErrors,
        });

        return;
      }

      const updatedFile = await this.fileService.updateFileMetadata(
        idResult.data,
        bodyResult.data,
      );

      res.status(StatusCodes.OK).json({ success: true, data: updatedFile });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /files/:id/thumbnail
   * Generate thumbnail for an image file
   */
  generateThumbnail = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (req.user === undefined) {
        res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });

        return;
      }

      const idResult = mongoIdSchema.safeParse(req.params['id']);
      if (!idResult.success) {
        res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Invalid file ID' });

        return;
      }

      const thumbnailUrl = await this.fileService.generateThumbnail(idResult.data);

      res.status(StatusCodes.OK).json({ success: true, data: { thumbnailUrl } });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: error.message });

        return;
      }

      if (error instanceof NotFoundError) {
        res.status(StatusCodes.NOT_FOUND).json({ success: false, message: error.message });

        return;
      }

      next(error);
    }
  };
}
