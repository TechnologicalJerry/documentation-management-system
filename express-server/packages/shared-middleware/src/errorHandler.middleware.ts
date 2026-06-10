import { Request, Response, NextFunction } from 'express';
import { isAppError } from '@devdocs/shared-utils';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';

export interface ErrorHandlerOptions {
  includeStack?: boolean;
  logger?: {
    error: (msg: string, meta?: Record<string, unknown>) => void;
    warn: (msg: string, meta?: Record<string, unknown>) => void;
  };
}

/**
 * Global error handling middleware.
 * Must be registered LAST, after all routes, with 4 parameters (err, req, res, next).
 */
export function errorHandler(options: ErrorHandlerOptions = {}) {
  const { includeStack = process.env['NODE_ENV'] === 'development', logger } = options;

  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    // Handle Zod validation errors (when not wrapped by validate middleware)
    if (err instanceof ZodError) {
      const details = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
        code: e.code,
      }));

      logger?.warn('Zod validation error', { requestId: req.requestId, errors: details });

      res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
        success: false,
        message: 'Validation failed',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details,
        },
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Handle known operational errors
    if (isAppError(err)) {
      if (err.statusCode >= 500) {
        logger?.error(`[${err.code}] ${err.message}`, {
          requestId: req.requestId,
          correlationId: req.correlationId,
          stack: err.stack,
          path: req.path,
          method: req.method,
        });
      } else {
        logger?.warn(`[${err.code}] ${err.message}`, {
          requestId: req.requestId,
          correlationId: req.correlationId,
          path: req.path,
          method: req.method,
        });
      }

      res.status(err.statusCode).json({
        success: false,
        message: err.message,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
          ...(includeStack && { stack: err.stack }),
        },
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Handle unknown / unexpected errors
    const error = err instanceof Error ? err : new Error(String(err));

    logger?.error(`Unhandled error: ${error.message}`, {
      requestId: req.requestId,
      correlationId: req.correlationId,
      stack: error.stack,
      path: req.path,
      method: req.method,
    });

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'An unexpected error occurred',
      error: {
        code: 'INTERNAL_ERROR',
        message: includeStack ? error.message : 'An unexpected error occurred',
        ...(includeStack && { stack: error.stack }),
      },
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  };
}
