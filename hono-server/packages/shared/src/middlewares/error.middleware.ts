import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';

import { HttpError } from '../lib/http-error';
import { logger } from '../config/logger';

export function handleAppError(err: unknown, c: Context) {
  if (err instanceof HttpError) {
    c.status(err.statusCode as ContentfulStatusCode);
    return c.json({
      error: {
        message: err.message,
        details: err.details
      }
    });
  }

  if (err instanceof ZodError) {
    return c.json(
      {
        error: {
          message: 'Validation failed',
          details: err.flatten()
        }
      },
      400
    );
  }

  logger.error('Unhandled exception', {
    path: c.req.path,
    method: c.req.method,
    error: err instanceof Error ? err.message : String(err)
  });

  return c.json(
    {
      error: {
        message: 'Internal server error'
      }
    },
    500
  );
}
