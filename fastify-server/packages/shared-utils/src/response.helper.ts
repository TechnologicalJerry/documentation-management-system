import { FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { ApiResponse, PaginatedResponse, PaginationMeta } from '@devdocs/shared-types';

export function sendSuccess<T>(
  reply: FastifyReply,
  data: T,
  message: string = 'Success',
  statusCode: number = StatusCodes.OK,
): FastifyReply {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
    requestId: (reply.getHeader('x-request-id') || reply.request?.id) as string | undefined,
  };
  return reply.status(statusCode).send(response);
}

export function sendCreated<T>(
  reply: FastifyReply,
  data: T,
  message: string = 'Resource created successfully',
): FastifyReply {
  return sendSuccess(reply, data, message, StatusCodes.CREATED);
}

export function sendNoContent(reply: FastifyReply): FastifyReply {
  return reply.status(StatusCodes.NO_CONTENT).send();
}

export function sendError(
  reply: FastifyReply,
  message: string,
  statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
  code: string = 'ERROR',
  details?: Record<string, unknown>,
): FastifyReply {
  const response: ApiResponse = {
    success: false,
    message,
    error: {
      code,
      message,
      details,
    },
    timestamp: new Date().toISOString(),
    requestId: (reply.getHeader('x-request-id') || reply.request?.id) as string | undefined,
  };
  return reply.status(statusCode).send(response);
}

export function sendPaginated<T>(
  reply: FastifyReply,
  data: T[],
  meta: PaginationMeta,
  message: string = 'Data retrieved successfully',
): FastifyReply {
  const paginatedData: PaginatedResponse<T> = {
    data,
    meta,
  };

  const response: ApiResponse<PaginatedResponse<T>> = {
    success: true,
    message,
    data: paginatedData,
    timestamp: new Date().toISOString(),
    requestId: (reply.getHeader('x-request-id') || reply.request?.id) as string | undefined,
  };

  return reply.status(StatusCodes.OK).send(response);
}

export function sendUnauthorized(
  reply: FastifyReply,
  message: string = 'Authentication required',
): FastifyReply {
  return sendError(reply, message, StatusCodes.UNAUTHORIZED, 'UNAUTHORIZED');
}

export function sendForbidden(
  reply: FastifyReply,
  message: string = 'Insufficient permissions',
): FastifyReply {
  return sendError(reply, message, StatusCodes.FORBIDDEN, 'FORBIDDEN');
}

export function sendNotFound(reply: FastifyReply, resource: string = 'Resource'): FastifyReply {
  return sendError(reply, `${resource} not found`, StatusCodes.NOT_FOUND, 'NOT_FOUND');
}

export function sendValidationError(
  reply: FastifyReply,
  message: string = 'Validation failed',
  details?: Record<string, unknown>,
): FastifyReply {
  return sendError(
    reply,
    message,
    StatusCodes.UNPROCESSABLE_ENTITY,
    'VALIDATION_ERROR',
    details,
  );
}
