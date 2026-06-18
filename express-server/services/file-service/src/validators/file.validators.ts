import { z } from 'zod';

export const uploadOptionsSchema = z.object({
  projectId: z.string().min(1).optional(),
  documentId: z.string().min(1).optional(),
  isPublic: z
    .union([z.boolean(), z.string()])
    .transform((val) => {
      if (typeof val === 'boolean') {
        return val;
      }

      return val === 'true';
    })
    .optional(),
  tags: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => {
      if (Array.isArray(val)) {
        return val;
      }

      return val
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    })
    .optional(),
});

export const fileQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1).default(1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1).max(100).default(20)),
  projectId: z.string().min(1).optional(),
  documentId: z.string().min(1).optional(),
  uploaderId: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional(),
  isPublic: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined) {
        return undefined;
      }

      return val === 'true';
    }),
  tags: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined) {
        return undefined;
      }

      return val
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    }),
  search: z.string().min(1).max(200).optional(),
});

export const updateFileMetadataSchema = z.object({
  originalName: z.string().min(1).max(512).optional(),
  isPublic: z.boolean().optional(),
  tags: z.array(z.string().min(1).max(100)).max(50).optional(),
  projectId: z.string().min(1).optional(),
  documentId: z.string().min(1).optional(),
});

export const mongoIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid MongoDB ObjectId');

export type UploadOptionsInput = z.input<typeof uploadOptionsSchema>;
export type UploadOptions = z.output<typeof uploadOptionsSchema>;
export type FileQueryInput = z.input<typeof fileQuerySchema>;
export type FileQuery = z.output<typeof fileQuerySchema>;
export type UpdateFileMetadata = z.infer<typeof updateFileMetadataSchema>;
