import { z } from 'zod';
import { GenerationType, GenerationStatus } from '../models/generation.model';

// ---------------------------------------------------------------------------
// Generate Request DTO
// ---------------------------------------------------------------------------
export const GenerateRequestSchema = z.object({
  type: z.nativeEnum(GenerationType, {
    errorMap: () => ({
      message: `type must be one of: ${Object.values(GenerationType).join(', ')}`,
    }),
  }),
  content: z
    .string({ required_error: 'content is required' })
    .min(1, 'content must not be empty')
    .max(100_000, 'content must be at most 100,000 characters'),
  context: z
    .string()
    .max(10_000, 'context must be at most 10,000 characters')
    .optional(),
  projectId: z.string().uuid('projectId must be a valid UUID').optional(),
  documentId: z.string().uuid('documentId must be a valid UUID').optional(),
  options: z
    .object({
      model: z.string().max(100).optional(),
      temperature: z
        .number()
        .min(0, 'temperature must be >= 0')
        .max(2, 'temperature must be <= 2')
        .optional(),
      maxTokens: z
        .number()
        .int('maxTokens must be an integer')
        .min(1, 'maxTokens must be >= 1')
        .max(32_768, 'maxTokens must be <= 32,768')
        .optional(),
      provider: z.enum(['ollama', 'openai', 'custom']).optional(),
      customSystemPrompt: z
        .string()
        .max(5_000, 'customSystemPrompt must be at most 5,000 characters')
        .optional(),
      variables: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});

export type GenerateRequestDto = z.infer<typeof GenerateRequestSchema>;

// ---------------------------------------------------------------------------
// Generate Query DTO (for listing generations)
// ---------------------------------------------------------------------------
export const GenerateQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : undefined))
    .pipe(
      z
        .number()
        .int()
        .min(1, 'page must be >= 1')
        .optional(),
    ),
  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : undefined))
    .pipe(
      z
        .number()
        .int()
        .min(1, 'limit must be >= 1')
        .max(100, 'limit must be <= 100')
        .optional(),
    ),
  type: z.nativeEnum(GenerationType).optional(),
  status: z.nativeEnum(GenerationStatus).optional(),
  projectId: z.string().uuid('projectId must be a valid UUID').optional(),
  documentId: z.string().uuid('documentId must be a valid UUID').optional(),
});

export type GenerateQueryDto = z.infer<typeof GenerateQuerySchema>;

// ---------------------------------------------------------------------------
// Validator middleware helpers
// ---------------------------------------------------------------------------
import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodType, ZodTypeDef, ZodError } from 'zod';

export function validateBody<Output, Input = any>(schema: ZodType<Output, ZodTypeDef, Input>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = (result.error as ZodError).errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
        success: false,
        error: 'Validation failed',
        errors,
      });

      return;
    }
    req.body = result.data as Record<string, unknown>;
    next();
  };
}

export function validateQuery<Output, Input = any>(schema: ZodType<Output, ZodTypeDef, Input>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = (result.error as ZodError).errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
        success: false,
        error: 'Validation failed',
        errors,
      });

      return;
    }
    // Safe to cast: validated data replaces query
    (req as Request & { validatedQuery: Output }).validatedQuery = result.data;
    next();
  };
}
