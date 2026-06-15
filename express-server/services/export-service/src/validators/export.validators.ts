import { z } from 'zod';
import { ExportFormat } from '../models/exportJob.model';

// ── ExportRequestDto ───────────────────────────────────────

export const ExportRequestDtoSchema = z.object({
  documentIds: z
    .array(z.string().min(1, 'Document ID cannot be empty'))
    .min(1, 'At least one document ID is required')
    .max(50, 'Cannot export more than 50 documents at once'),

  projectId: z.string().optional(),

  format: z.nativeEnum(ExportFormat, {
    errorMap: () => ({
      message: `Format must be one of: ${Object.values(ExportFormat).join(', ')}`,
    }),
  }),

  options: z
    .object({
      includeTableOfContents: z.boolean().default(false),
      includeMetadata: z.boolean().default(true),
      theme: z.enum(['default', 'light', 'dark', 'professional']).default('default'),
      watermark: z.string().max(100, 'Watermark must be at most 100 characters').optional(),
    })
    .default({
      includeTableOfContents: false,
      includeMetadata: true,
      theme: 'default',
    }),
});

export type ExportRequestDto = z.infer<typeof ExportRequestDtoSchema>;

// ── ExportQueryDto ────────────────────────────────────────

export const ExportQueryDtoSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1, 'Page must be at least 1')),

  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1).max(100, 'Limit must be at most 100')),

  status: z
    .enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'])
    .optional(),

  format: z.nativeEnum(ExportFormat).optional(),

  sortBy: z
    .enum(['createdAt', 'updatedAt', 'completedAt', 'format', 'status'])
    .default('createdAt'),

  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ExportQueryDto = z.infer<typeof ExportQueryDtoSchema>;

// ── Re-usable validation helper ───────────────────────────

export function validateExportRequest(data: unknown): ExportRequestDto {
  return ExportRequestDtoSchema.parse(data);
}

export function validateExportQuery(data: unknown): ExportQueryDto {
  return ExportQueryDtoSchema.parse(data);
}
