import { FastifyRequest, FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';

/**
 * 404 Not Found hook.
 */
export async function notFound(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(StatusCodes.NOT_FOUND).send({
    success: false,
    message: `Route ${request.method} ${request.url} not found`,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Cannot ${request.method} ${request.url}`,
    },
    requestId: request.requestId,
    timestamp: new Date().toISOString(),
  });
}
