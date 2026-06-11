import { StatusCodes } from 'http-status-codes';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: string;

  constructor(
    message: string,
    statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, StatusCodes.NOT_FOUND, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, StatusCodes.UNAUTHORIZED, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, StatusCodes.FORBIDDEN, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, StatusCodes.CONFLICT, 'CONFLICT');
  }
}

export class ValidationError extends AppError {
  public readonly errors: unknown;

  constructor(message: string = 'Validation failed', errors?: unknown) {
    super(message, StatusCodes.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request') {
    super(message, StatusCodes.BAD_REQUEST, 'BAD_REQUEST');
  }
}

export class AIProviderError extends AppError {
  constructor(message: string = 'AI provider error', public readonly providerName?: string) {
    super(message, StatusCodes.BAD_GATEWAY, 'AI_PROVIDER_ERROR');
  }
}

export class GenerationTimeoutError extends AppError {
  constructor(timeoutMs: number) {
    super(
      `AI generation timed out after ${timeoutMs}ms`,
      StatusCodes.GATEWAY_TIMEOUT,
      'GENERATION_TIMEOUT',
    );
  }
}

export class GenerationCancelledError extends AppError {
  constructor() {
    super('Generation was cancelled', StatusCodes.CONFLICT, 'GENERATION_CANCELLED');
  }
}

export class QueueFullError extends AppError {
  constructor() {
    super(
      'Generation queue is full. Please try again later.',
      StatusCodes.TOO_MANY_REQUESTS,
      'QUEUE_FULL',
    );
  }
}
