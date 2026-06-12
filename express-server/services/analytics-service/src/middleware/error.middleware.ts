import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AppError, isAppError } from '@devdocs/shared-utils';
import { config } from '../config';
import { logger } from '../lib/logger';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` },
  });
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = isAppError(err) ? err.statusCode : StatusCodes.INTERNAL_SERVER_ERROR;
  logger.error('Analytics request failed', {
    method: req.method,
    url: req.originalUrl,
    message: err.message,
    stack: err.stack,
  });
  res.status(statusCode).json({
    success: false,
    error: {
      code: isAppError(err) ? err.code : 'INTERNAL_SERVER_ERROR',
      message: config.app.isProduction && statusCode === 500 ? 'Internal server error' : err.message,
    },
  });
}
