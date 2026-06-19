import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodSchema, ZodError } from 'zod';

type RequestSection = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, source: RequestSection = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errors = formatZodErrors(result.error);
      res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors,
      });

      return;
    }

    // Assign parsed/coerced value back to request
    (req as unknown as Record<string, unknown>)[source] = result.data;
    next();
  };
}

function formatZodErrors(error: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || 'root';
    if (errors[path] === undefined) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  }

  return errors;
}
