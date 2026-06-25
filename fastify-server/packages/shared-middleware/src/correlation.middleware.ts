import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

declare module 'fastify' {
  interface FastifyRequest {
    correlationId?: string;
    causationId?: string;
  }
}

const CORRELATION_ID_HEADER = 'X-Correlation-ID';
const CAUSATION_ID_HEADER = 'X-Causation-ID';

/**
 * Hook that tracks distributed tracing correlation IDs.
 */
export async function correlationId(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const incomingCorrelationId = request.headers[CORRELATION_ID_HEADER.toLowerCase()] as
    | string
    | undefined;
  const incomingCausationId = request.headers[CAUSATION_ID_HEADER.toLowerCase()] as
    | string
    | undefined;

  // Preserve the correlation ID from upstream or create a new one
  const cid = incomingCorrelationId || uuidv4();
  const causation = incomingCausationId || request.requestId;

  request.correlationId = cid;
  request.causationId = causation;

  // Propagate on response headers
  reply.header(CORRELATION_ID_HEADER, cid);
  if (causation) {
    reply.header(CAUSATION_ID_HEADER, causation);
  }
}

/**
 * Helper to build outbound request headers with tracing context.
 * Use when making HTTP calls to other services.
 */
export function buildTracingHeaders(request: FastifyRequest): Record<string, string> {
  const headers: Record<string, string> = {};

  if (request.correlationId) {
    headers[CORRELATION_ID_HEADER] = request.correlationId;
  }

  // The outgoing request's causation is the current request's ID
  if (request.requestId) {
    headers[CAUSATION_ID_HEADER] = request.requestId;
  }

  return headers;
}
