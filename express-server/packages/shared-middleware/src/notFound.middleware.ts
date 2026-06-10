import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';

/**
 * 404 Not Found middleware.
 * Must be registered AFTER all valid routes.
 * Passes a structured error to the error handler.
 */
export function notFound(req: Request, res: Response, _next: NextFunction): void {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
    },
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  });
}
