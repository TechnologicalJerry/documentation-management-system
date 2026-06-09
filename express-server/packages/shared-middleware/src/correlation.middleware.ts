import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      causationId?: string;
    }
  }
}

const CORRELATION_ID_HEADER = 'X-Correlation-ID';
const CAUSATION_ID_HEADER = 'X-Causation-ID';

/**
 * Middleware that tracks distributed tracing correlation IDs.
 *
 * Correlation ID: Groups all related requests across services (stays the same throughout a flow)
 * Causation ID: The ID of the event/request that caused this request
 *
 * Usage in service calls: forward X-Correlation-ID, set X-Causation-ID to current request ID
 */
export function correlationId(req: Request, res: Response, next: NextFunction): void {
  const incomingCorrelationId = req.headers[CORRELATION_ID_HEADER.toLowerCase()] as
    | string
    | undefined;
  const incomingCausationId = req.headers[CAUSATION_ID_HEADER.toLowerCase()] as
    | string
    | undefined;

  // Preserve the correlation ID from upstream or create a new one
  const cid = incomingCorrelationId || uuidv4();
  const causation = incomingCausationId || req.requestId;

  req.correlationId = cid;
  req.causationId = causation;

  // Propagate on response headers
  res.setHeader(CORRELATION_ID_HEADER, cid);
  if (causation) {
    res.setHeader(CAUSATION_ID_HEADER, causation);
  }

  next();
}

/**
 * Helper to build outbound request headers with tracing context.
 * Use when making HTTP calls to other services.
 */
export function buildTracingHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {};

  if (req.correlationId) {
    headers[CORRELATION_ID_HEADER] = req.correlationId;
  }

  // The outgoing request's causation is the current request's ID
  if (req.requestId) {
    headers[CAUSATION_ID_HEADER] = req.requestId;
  }

  return headers;
}
