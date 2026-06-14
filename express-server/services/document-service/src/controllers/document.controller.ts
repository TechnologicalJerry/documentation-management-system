import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { IDocumentService } from '../services/document.service';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  DocumentQueryDto,
  SearchDocumentsDto,
  DocumentServiceError,
} from '../types/document.types';
import { logger } from '../lib/logger';

export class DocumentController {
  constructor(private readonly documentService: IDocumentService) {}

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private getUserId(req: Request): string {
    // Assumes upstream API Gateway injects x-user-id header after JWT verification
    const userId = req.headers['x-user-id'];
    if (typeof userId !== 'string' || userId === '') {
      throw new DocumentServiceError('PERMISSION_DENIED', 'Unauthenticated request', StatusCodes.UNAUTHORIZED);
    }

    return userId;
  }

  private handleError(err: unknown, res: Response): void {
    if (err instanceof DocumentServiceError) {
      res.status(err.statusCode).json({
        success: false,
        error: { code: err.code, message: err.message },
      });

      return;
    }

    logger.error('Unexpected error in DocumentController', { error: err });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  createDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { projectId } = req.params;
      const dto = req.body as CreateDocumentDto;

      const document = await this.documentService.createDocument(userId, projectId, dto);

      res.status(StatusCodes.CREATED).json({ success: true, data: document });
    } catch (err) {
      if (err instanceof DocumentServiceError) {
        this.handleError(err, res);
      } else {
        next(err);
      }
    }
  };

  getDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.headers['x-user-id'] as string | undefined;
      const { id } = req.params;

      const document = await this.documentService.getDocument(id, userId);

      res.status(StatusCodes.OK).json({ success: true, data: document });
    } catch (err) {
      if (err instanceof DocumentServiceError) {
        this.handleError(err, res);
      } else {
        next(err);
      }
    }
  };

  getDocuments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const query = req.query as unknown as DocumentQueryDto;

      const result = await this.documentService.getDocuments(projectId, query);

      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      if (err instanceof DocumentServiceError) {
        this.handleError(err, res);
      } else {
        next(err);
      }
    }
  };

  updateDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { id } = req.params;
      const dto = req.body as UpdateDocumentDto;

      const document = await this.documentService.updateDocument(id, userId, dto);

      res.status(StatusCodes.OK).json({ success: true, data: document });
    } catch (err) {
      if (err instanceof DocumentServiceError) {
        this.handleError(err, res);
      } else {
        next(err);
      }
    }
  };

  deleteDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { id } = req.params;

      await this.documentService.deleteDocument(id, userId);

      res.status(StatusCodes.NO_CONTENT).send();
    } catch (err) {
      if (err instanceof DocumentServiceError) {
        this.handleError(err, res);
      } else {
        next(err);
      }
    }
  };

  publishDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { id } = req.params;

      const document = await this.documentService.publishDocument(id, userId);

      res.status(StatusCodes.OK).json({ success: true, data: document });
    } catch (err) {
      if (err instanceof DocumentServiceError) {
        this.handleError(err, res);
      } else {
        next(err);
      }
    }
  };

  archiveDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { id } = req.params;

      const document = await this.documentService.archiveDocument(id, userId);

      res.status(StatusCodes.OK).json({ success: true, data: document });
    } catch (err) {
      if (err instanceof DocumentServiceError) {
        this.handleError(err, res);
      } else {
        next(err);
      }
    }
  };

  submitForReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { id } = req.params;

      const document = await this.documentService.submitForReview(id, userId);

      res.status(StatusCodes.OK).json({ success: true, data: document });
    } catch (err) {
      if (err instanceof DocumentServiceError) {
        this.handleError(err, res);
      } else {
        next(err);
      }
    }
  };

  lockDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { id } = req.params;

      const document = await this.documentService.lockDocument(id, userId);

      res.status(StatusCodes.OK).json({ success: true, data: document });
    } catch (err) {
      if (err instanceof DocumentServiceError) {
        this.handleError(err, res);
      } else {
        next(err);
      }
    }
  };

  unlockDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { id } = req.params;

      const document = await this.documentService.unlockDocument(id, userId);

      res.status(StatusCodes.OK).json({ success: true, data: document });
    } catch (err) {
      if (err instanceof DocumentServiceError) {
        this.handleError(err, res);
      } else {
        next(err);
      }
    }
  };

  searchDocuments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const { q, status, tags, page, limit } = req.query as Record<string, string | undefined>;

      const dto: SearchDocumentsDto = {
        query: q ?? '',
        projectId,
        status: status as SearchDocumentsDto['status'],
        tags: tags !== undefined ? tags.split(',') : undefined,
        page: page !== undefined ? parseInt(page, 10) : undefined,
        limit: limit !== undefined ? parseInt(limit, 10) : undefined,
      };

      const result = await this.documentService.searchDocuments(dto);

      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      if (err instanceof DocumentServiceError) {
        this.handleError(err, res);
      } else {
        next(err);
      }
    }
  };

  getDocumentTree = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;

      const tree = await this.documentService.getDocumentTree(projectId);

      res.status(StatusCodes.OK).json({ success: true, data: tree });
    } catch (err) {
      if (err instanceof DocumentServiceError) {
        this.handleError(err, res);
      } else {
        next(err);
      }
    }
  };
}
