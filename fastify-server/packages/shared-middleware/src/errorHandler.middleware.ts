import { FastifyRequest, FastifyReply } from 'fastify';
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
 * Global error handling hook for Fastify.
 */
export function errorHandler(options: ErrorHandlerOptions = {}) {
  const { includeStack = process.env['NODE_ENV'] === 'development', logger } = options;

  return (error: any, request: FastifyRequest, reply: FastifyReply): void => {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      const details = error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
        code: e.code,
      }));

      logger?.warn('Zod validation error', { requestId: request.requestId, errors: details });

      reply.status(StatusCodes.UNPROCESSABLE_ENTITY).send({
        success: false,
        message: 'Validation failed',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details,
        },
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Handle Fastify/Ajv internal validation errors
    if (error.validation) {
      const details = error.validation.map((e: any) => ({
        field: e.instancePath.replace(/^\//, '') || e.params.missingProperty || 'unknown',
        message: e.message,
        code: e.keyword,
      }));

      logger?.warn('Ajv validation error', { requestId: request.requestId, errors: details });

      reply.status(StatusCodes.UNPROCESSABLE_ENTITY).send({
        success: false,
        message: 'Validation failed',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details,
        },
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Handle known operational errors (AppError)
    if (isAppError(error)) {
      if (error.statusCode >= 500) {
        logger?.error(`[${error.code}] ${error.message}`, {
          requestId: request.requestId,
          correlationId: request.correlationId,
          stack: error.stack,
          path: request.url,
          method: request.method,
        });
      } else {
        logger?.warn(`[${error.code}] ${error.message}`, {
          requestId: request.requestId,
          correlationId: request.correlationId,
          path: request.url,
          method: request.method,
        });
      }

      reply.status(error.statusCode).send({
        success: false,
        message: error.message,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          ...(includeStack && { stack: error.stack }),
        },
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Handle unknown / unexpected errors
    const err = error instanceof Error ? error : new Error(String(error));

    logger?.error(`Unhandled error: ${err.message}`, {
      requestId: request.requestId,
      correlationId: request.correlationId,
      stack: err.stack,
      path: request.url,
      method: request.method,
    });

    reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
      success: false,
      message: 'An unexpected error occurred',
      error: {
        code: 'INTERNAL_ERROR',
        message: includeStack ? err.message : 'An unexpected error occurred',
        ...(includeStack && { stack: err.stack }),
      },
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
    });
  };
}
