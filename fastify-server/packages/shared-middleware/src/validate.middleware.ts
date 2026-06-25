import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema, ZodError, z } from 'zod';
import { ValidationError, ErrorDetails } from '@devdocs/shared-utils';

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
export function validate(schema: ZodSchema, part?: RequestPart) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const isWrapped =
      schema instanceof z.ZodObject &&
      ('body' in schema.shape || 'query' in schema.shape || 'params' in schema.shape);

    if (isWrapped && !part) {
      const result = schema.safeParse({
        body: request.body,
        query: request.query,
        params: request.params,
        headers: request.headers,
      });

      if (!result.success) {
        const details = formatZodErrors(result.error);
        throw new ValidationError('Validation failed', details);
      }

      if (result.data.body !== undefined) request.body = result.data.body;
      if (result.data.query !== undefined) request.query = result.data.query;
      if (result.data.params !== undefined) request.params = result.data.params;
    } else {
      const targetPart = part || 'body';
      const result = schema.safeParse(request[targetPart]);

      if (!result.success) {
        const details = formatZodErrors(result.error);
        throw new ValidationError(`Validation failed for request ${targetPart}`, details);
      }

      // Replace with parsed/coerced value
      (request as unknown as Record<string, unknown>)[targetPart] = result.data;
    }
  };
}

/**
 * Validate multiple parts of the request in one middleware.
 */
export function validateRequest(targets: ValidationTarget) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const allErrors: ErrorDetails[] = [];

    for (const [part, schema] of Object.entries(targets) as [RequestPart, ZodSchema][]) {
      if (!schema) continue;

      const result = schema.safeParse(request[part]);

      if (!result.success) {
        const details = formatZodErrors(result.error);
        allErrors.push(...details.map((d) => ({ ...d, location: part })));
      } else {
        (request as unknown as Record<string, unknown>)[part] = result.data;
      }
    }

    if (allErrors.length > 0) {
      throw new ValidationError('Request validation failed', allErrors);
    }
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
