import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { StatusCodes } from 'http-status-codes';

/**
 * Express middleware factory that validates req.body, req.query, and req.params
 * against a Zod schema that has `body`, `query`, and/or `params` sub-schemas.
 */
export function validate(schema: AnyZodObject) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Replace req fields with coerced/transformed values from Zod
      if (parsed.body !== undefined) {
        req.body = parsed.body as unknown;
      }
      if (parsed.query !== undefined) {
        req.query = parsed.query as Record<string, string>;
      }
      if (parsed.params !== undefined) {
        req.params = parsed.params as Record<string, string>;
      }

      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: errors,
          },
        });

        return;
      }

      next(err);
    }
  };
}
