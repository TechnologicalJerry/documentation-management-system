import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, z } from 'zod';
import { ValidationError } from '@devdocs/shared-utils';
import { ErrorDetails } from '@devdocs/shared-utils';

type RequestPart = 'body' | 'query' | 'params' | 'headers';

interface ValidationTarget {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
}

/**
 * Format Zod errors into our ErrorDetails shape
 */
function formatZodErrors(error: ZodError): ErrorDetails[] {
  return error.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
    code: e.code,
  }));
}

/**
 * Validate a specific part of the request against a Zod schema.
 * Replaces the request part with the parsed (coerced) value.
 */
export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      const details = formatZodErrors(result.error);
      return next(new ValidationError(`Validation failed for request ${part}`, details));
    }

    // Replace with parsed/coerced value
    (req as unknown as Record<string, unknown>)[part] = result.data;
    next();
  };
}

/**
 * Validate multiple parts of the request in one middleware.
 */
export function validateRequest(targets: ValidationTarget) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const allErrors: ErrorDetails[] = [];

    for (const [part, schema] of Object.entries(targets) as [RequestPart, ZodSchema][]) {
      if (!schema) continue;

      const result = schema.safeParse(req[part]);

      if (!result.success) {
        const details = formatZodErrors(result.error);
        allErrors.push(...details.map((d) => ({ ...d, location: part })));
      } else {
        (req as unknown as Record<string, unknown>)[part] = result.data;
      }
    }

    if (allErrors.length > 0) {
      return next(new ValidationError('Request validation failed', allErrors));
    }

    next();
  };
}

/**
 * Common reusable schemas
 */
export const commonSchemas = {
  uuid: z.string().uuid('Invalid UUID format'),
  positiveInt: z.coerce.number().int().positive(),
  paginationQuery: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    search: z.string().max(255).optional(),
  }),
  idParam: z.object({
    id: z.string().uuid('Invalid ID format'),
  }),
};
