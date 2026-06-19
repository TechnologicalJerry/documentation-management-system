import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Prisma } from '@prisma/client';
import { AppError, ValidationError } from '../lib/errors';
import { logger } from '../lib/logger';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Operational application errors
  if (err instanceof AppError) {
    if (err instanceof ValidationError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
        code: err.code,
        errors: err.errors,
      });

      return;
    }

    if (!err.isOperational) {
      logger.error('Non-operational AppError', { error: err });
    }

    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
    });

    return;
  }

  // Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    handlePrismaError(err, res);

    return;
  }

  // Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Invalid database operation',
      code: 'DB_VALIDATION_ERROR',
    });

    return;
  }

  // Unknown errors
  logger.error('Unhandled error', { error: err });
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
  });
}

function handlePrismaError(
  err: Prisma.PrismaClientKnownRequestError,
  res: Response,
): void {
  switch (err.code) {
    case 'P2002':
      // Unique constraint violation
      res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: 'A resource with this value already exists',
        code: 'CONFLICT',
        field: Array.isArray(err.meta?.['target']) ? (err.meta['target'] as string[]).join(', ') : undefined,
      });
      break;

    case 'P2025':
      // Record not found
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      });
      break;

    case 'P2003':
      // Foreign key constraint
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Related resource not found',
        code: 'FOREIGN_KEY_ERROR',
      });
      break;

    default:
      logger.error('Unhandled Prisma error', { code: err.code, error: err });
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Database error',
        code: 'DB_ERROR',
      });
  }
}
