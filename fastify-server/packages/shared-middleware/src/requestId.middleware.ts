import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

declare module 'fastify' {
  interface FastifyRequest {
    requestId?: string;
  }
}

const REQUEST_ID_HEADER = 'X-Request-ID';

/**
 * Hook that attaches a unique request ID to each request.
 * - Reads X-Request-ID from incoming headers (from upstream proxy or client)
 * - Generates a new UUID v4 if not present
 * - Sets the header on the response for client tracing
 * - Attaches the ID to request.requestId for downstream use
 */
export async function requestId(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const incomingId = request.headers[REQUEST_ID_HEADER.toLowerCase()] as string | undefined;
  const id = incomingId || request.id || uuidv4();

  request.requestId = id;

  // Set on response so clients can trace the request
  reply.header(REQUEST_ID_HEADER, id);
}
