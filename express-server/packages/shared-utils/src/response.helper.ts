import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiResponse, PaginatedResponse, PaginationMeta } from '@devdocs/shared-types';

export function sendSuccess<T>(
  res: Response,
  data: T,
  message: string = 'Success',
  statusCode: number = StatusCodes.OK,
): Response {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
    requestId: res.getHeader('X-Request-ID') as string | undefined,
  };
  return res.status(statusCode).json(response);
}

export function sendCreated<T>(
  res: Response,
  data: T,
  message: string = 'Resource created successfully',
): Response {
  return sendSuccess(res, data, message, StatusCodes.CREATED);
}

export function sendNoContent(res: Response): Response {
  return res.status(StatusCodes.NO_CONTENT).send();
}

export function sendError(
  res: Response,
  message: string,
  statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
  code: string = 'ERROR',
  details?: Record<string, unknown>,
): Response {
  const response: ApiResponse = {
    success: false,
    message,
    error: {
      code,
      message,
      details,
    },
    timestamp: new Date().toISOString(),
    requestId: res.getHeader('X-Request-ID') as string | undefined,
  };
  return res.status(statusCode).json(response);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: PaginationMeta,
  message: string = 'Data retrieved successfully',
): Response {
  const paginatedData: PaginatedResponse<T> = {
    data,
    meta,
  };

  const response: ApiResponse<PaginatedResponse<T>> = {
    success: true,
    message,
    data: paginatedData,
    timestamp: new Date().toISOString(),
    requestId: res.getHeader('X-Request-ID') as string | undefined,
  };

  return res.status(StatusCodes.OK).json(response);
}

export function sendUnauthorized(
  res: Response,
  message: string = 'Authentication required',
): Response {
  return sendError(res, message, StatusCodes.UNAUTHORIZED, 'UNAUTHORIZED');
}

export function sendForbidden(
  res: Response,
  message: string = 'Insufficient permissions',
): Response {
  return sendError(res, message, StatusCodes.FORBIDDEN, 'FORBIDDEN');
}

export function sendNotFound(res: Response, resource: string = 'Resource'): Response {
  return sendError(res, `${resource} not found`, StatusCodes.NOT_FOUND, 'NOT_FOUND');
}

export function sendValidationError(
  res: Response,
  message: string = 'Validation failed',
  details?: Record<string, unknown>,
): Response {
  return sendError(
    res,
    message,
    StatusCodes.UNPROCESSABLE_ENTITY,
    'VALIDATION_ERROR',
    details,
  );
}
