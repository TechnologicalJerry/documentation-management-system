import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

const REQUEST_ID_HEADER = 'X-Request-ID';

/**
 * Middleware that attaches a unique request ID to each request.
 * - Reads X-Request-ID from incoming headers (from upstream proxy or client)
 * - Generates a new UUID v4 if not present
 * - Sets the header on the response for client tracing
 * - Attaches the ID to req.requestId for downstream use
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers[REQUEST_ID_HEADER.toLowerCase()] as string | undefined;
  const id = incomingId || uuidv4();

  req.requestId = id;

  // Set on response so clients can trace the request
  res.setHeader(REQUEST_ID_HEADER, id);

  next();
}
