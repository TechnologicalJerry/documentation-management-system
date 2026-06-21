import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../types/user.types';
import { logger } from '../utils/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
  });

  // Zod validation errors
  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || 'root';
      if (!errors[key]) {
        errors[key] = [];
      }
      errors[key].push(issue.message);
    }
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      success: false,
      message: 'Validation failed',
      errors,
    });

    return;
  }

  // Known application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
    });

    return;
  }

  // Prisma-specific errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const fields = (err.meta?.['target'] as string[]) ?? [];
        res.status(StatusCodes.CONFLICT).json({
          success: false,
          message: `A record with this ${fields.join(', ')} already exists`,
          code: 'UNIQUE_CONSTRAINT',
        });

        return;
      }
      case 'P2025':
        res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: 'Record not found',
          code: 'NOT_FOUND',
        });

        return;
      case 'P2003':
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'Invalid foreign key reference',
          code: 'FOREIGN_KEY_CONSTRAINT',
        });

        return;
      default:
        break;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Invalid data provided',
      code: 'VALIDATION_ERROR',
    });

    return;
  }

  // Multer errors
  if (err.name === 'MulterError') {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: err.message,
      code: 'FILE_UPLOAD_ERROR',
    });

    return;
  }

  // Generic server error
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message:
      process.env['NODE_ENV'] === 'production'
        ? 'An unexpected error occurred'
        : err.message,
    code: 'INTERNAL_SERVER_ERROR',
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
    code: 'ROUTE_NOT_FOUND',
  });
}
