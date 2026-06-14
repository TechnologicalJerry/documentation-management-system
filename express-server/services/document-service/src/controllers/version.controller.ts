import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { IVersionService } from '../services/version.service';
import { DocumentServiceError } from '../types/document.types';
import { logger } from '../lib/logger';

export class VersionController {
  constructor(private readonly versionService: IVersionService) {}

  private handleError(err: unknown, res: Response): void {
    if (err instanceof DocumentServiceError) {
      res.status(err.statusCode).json({
        success: false,
        error: { code: err.code, message: err.message },
      });

      return;
    }

    logger.error('Unexpected error in VersionController', { error: err });
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

  getVersions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const versions = await this.versionService.getVersions(id);

      res.status(StatusCodes.OK).json({ success: true, data: versions });
    } catch (err) {
      if (err instanceof DocumentServiceError) {
        this.handleError(err, res);
      } else {
        next(err);
      }
    }
  };

  getVersion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, version } = req.params;
      const versionNum = parseInt(version, 10);

      if (isNaN(versionNum) || versionNum < 1) {
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Version must be a positive integer' },
        });

        return;
      }

      const versionDoc = await this.versionService.getVersion(id, versionNum);

      res.status(StatusCodes.OK).json({ success: true, data: versionDoc });
    } catch (err) {
      if (err instanceof DocumentServiceError) {
        this.handleError(err, res);
      } else {
        next(err);
      }
    }
  };

  restoreVersion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { id, version } = req.params;
      const versionNum = parseInt(version, 10);

      if (isNaN(versionNum) || versionNum < 1) {
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Version must be a positive integer' },
        });

        return;
      }

      const restoredVersion = await this.versionService.restoreVersion(id, versionNum, userId);

      res.status(StatusCodes.OK).json({ success: true, data: restoredVersion });
    } catch (err) {
      if (err instanceof DocumentServiceError) {
        this.handleError(err, res);
      } else {
        next(err);
      }
    }
  };

  compareVersions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { v1, v2 } = req.query as { v1?: string; v2?: string };

      if (v1 === undefined || v2 === undefined) {
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Both v1 and v2 query params are required' },
        });

        return;
      }

      const v1Num = parseInt(v1, 10);
      const v2Num = parseInt(v2, 10);

      if (isNaN(v1Num) || isNaN(v2Num) || v1Num < 1 || v2Num < 1) {
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'v1 and v2 must be positive integers' },
        });

        return;
      }

      const diff = await this.versionService.compareVersions(id, v1Num, v2Num);

      res.status(StatusCodes.OK).json({ success: true, data: diff });
    } catch (err) {
      if (err instanceof DocumentServiceError) {
        this.handleError(err, res);
      } else {
        next(err);
      }
    }
  };
}
