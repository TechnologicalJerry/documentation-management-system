import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import multer from 'multer';
import { logger } from '../lib/logger';
import { NotFoundError, ValidationError, ForbiddenError } from '../services/file.service';

interface ApiError extends Error {
  statusCode?: number;
}

export function errorMiddleware(
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error('Request error', {
    name: err.name,
    message: err.message,
    stack: err.stack,
  });

  if (err instanceof multer.MulterError) {
    const status =
      err.code === 'LIMIT_FILE_SIZE'
        ? StatusCodes.REQUEST_TOO_LONG
        : StatusCodes.BAD_REQUEST;

    res.status(status).json({
      success: false,
      message:
        err.code === 'LIMIT_FILE_SIZE'
          ? `File exceeds maximum allowed size`
          : err.message,
    });

    return;
  }

  if (err instanceof NotFoundError) {
    res.status(StatusCodes.NOT_FOUND).json({ success: false, message: err.message });

    return;
  }

  if (err instanceof ValidationError) {
    res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: err.message });

    return;
  }

  if (err instanceof ForbiddenError) {
    res.status(StatusCodes.FORBIDDEN).json({ success: false, message: err.message });

    return;
  }

  if (err.statusCode !== undefined) {
    res.status(err.statusCode).json({ success: false, message: err.message });

    return;
  }

  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: 'An unexpected error occurred',
  });
}

export function notFoundMiddleware(_req: Request, res: Response): void {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: 'Route not found',
  });
}
