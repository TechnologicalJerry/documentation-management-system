import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ICommentService } from '../services/comment.service';
import { CreateCommentDto, UpdateCommentDto, DocumentServiceError } from '../types/document.types';
import { logger } from '../lib/logger';

export class CommentController {
  constructor(private readonly commentService: ICommentService) {}

  private handleError(err: unknown, res: Response): void {
    if (err instanceof DocumentServiceError) {
      res.status(err.statusCode).json({
        success: false,
        error: { code: err.code, message: err.message },
      });

      return;
    }

    logger.error('Unexpected error in CommentController', { error: err });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }

  private getUserId(req: Request): string {
    const userId = req.headers['x-user-id'];
    if (typeof userId !== 'string' || userId === '') {
      throw new DocumentServiceError('PERMISSION_DENIED', 'Unauthenticated request', StatusCodes.UNAUTHORIZED);
    }

    return userId;
  }

  addComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { id: documentId } = req.params;
      const dto = req.body as CreateCommentDto;

      const comment = await this.commentService.addComment(documentId, userId, dto);

      res.status(StatusCodes.CREATED).json({ success: true, data: comment });
    } catch (err) {
      if (err instanceof DocumentServiceError) {
        this.handleError(err, res);
      } else {
        next(err);
      }
    }
  };

  getComments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id: documentId } = req.params;

      const comments = await this.commentService.getComments(documentId);

      res.status(StatusCodes.OK).json({ success: true, data: comments });
    } catch (err) {
      if (err instanceof DocumentServiceError) {
        this.handleError(err, res);
      } else {
        next(err);
      }
    }
  };

  updateComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { commentId } = req.params;
      const dto = req.body as UpdateCommentDto;

      const comment = await this.commentService.updateComment(commentId, userId, dto);

      res.status(StatusCodes.OK).json({ success: true, data: comment });
    } catch (err) {
      if (err instanceof DocumentServiceError) {
        this.handleError(err, res);
      } else {
        next(err);
      }
    }
  };

  deleteComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { commentId } = req.params;

      await this.commentService.deleteComment(commentId, userId);

      res.status(StatusCodes.NO_CONTENT).send();
    } catch (err) {
      if (err instanceof DocumentServiceError) {
        this.handleError(err, res);
      } else {
        next(err);
      }
    }
  };

  resolveComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { commentId } = req.params;

      const comment = await this.commentService.resolveComment(commentId, userId);

      res.status(StatusCodes.OK).json({ success: true, data: comment });
    } catch (err) {
      if (err instanceof DocumentServiceError) {
        this.handleError(err, res);
      } else {
        next(err);
      }
    }
  };

  unresolveComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { commentId } = req.params;

      const comment = await this.commentService.unresolveComment(commentId, userId);

      res.status(StatusCodes.OK).json({ success: true, data: comment });
    } catch (err) {
      if (err instanceof DocumentServiceError) {
        this.handleError(err, res);
      } else {
        next(err);
      }
    }
  };
}
