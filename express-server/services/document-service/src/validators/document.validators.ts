import { z } from 'zod';
import { DocumentStatus, DocumentType } from '../models/document.model';

// ─── Shared primitives ────────────────────────────────────────────────────────

const mongoIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid MongoDB ObjectId');

const tagsSchema = z
  .array(z.string().trim().min(1).max(50))
  .max(20, 'Maximum 20 tags allowed')
  .optional();

const metadataSchema = z.record(z.unknown()).optional();

// ─── Document schemas ─────────────────────────────────────────────────────────

export const createDocumentSchema = z.object({
  body: z.object({
    title: z
      .string()
      .trim()
      .min(1, 'Title is required')
      .max(500, 'Title must not exceed 500 characters'),
    content: z.string().optional(),
    contentHtml: z.string().optional(),
    excerpt: z.string().trim().max(500).optional(),
    type: z.nativeEnum(DocumentType).optional(),
    parentId: mongoIdSchema.optional(),
    order: z.number().int().min(0).optional(),
    tags: tagsSchema,
    metadata: metadataSchema,
    isPublic: z.boolean().optional(),
  }),
});

export const updateDocumentSchema = z.object({
  params: z.object({
    id: mongoIdSchema,
  }),
  body: z
    .object({
      title: z.string().trim().min(1).max(500).optional(),
      content: z.string().optional(),
      contentHtml: z.string().optional(),
      excerpt: z.string().trim().max(500).optional(),
      type: z.nativeEnum(DocumentType).optional(),
      parentId: mongoIdSchema.nullable().optional(),
      order: z.number().int().min(0).optional(),
      tags: tagsSchema,
      metadata: metadataSchema,
      isPublic: z.boolean().optional(),
      changeDescription: z.string().max(1000).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided for update',
    }),
});

export const documentIdParamSchema = z.object({
  params: z.object({
    id: mongoIdSchema,
  }),
});

export const projectIdParamSchema = z.object({
  params: z.object({
    projectId: mongoIdSchema,
  }),
});

export const documentQuerySchema = z.object({
  query: z.object({
    status: z.nativeEnum(DocumentStatus).optional(),
    type: z.nativeEnum(DocumentType).optional(),
    tags: z.union([z.string(), z.array(z.string())]).optional(),
    authorId: z.string().optional(),
    isPublic: z
      .string()
      .transform((v) => v === 'true')
      .optional(),
    parentId: z.string().optional(),
    page: z
      .string()
      .transform((v) => parseInt(v, 10))
      .refine((v) => !isNaN(v) && v >= 1, 'page must be a positive integer')
      .optional(),
    limit: z
      .string()
      .transform((v) => parseInt(v, 10))
      .refine((v) => !isNaN(v) && v >= 1 && v <= 100, 'limit must be between 1 and 100')
      .optional(),
    sortBy: z
      .enum(['createdAt', 'updatedAt', 'title', 'order', 'status'])
      .optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    includeDeleted: z
      .string()
      .transform((v) => v === 'true')
      .optional(),
  }),
});

export const searchQuerySchema = z.object({
  query: z.object({
    q: z.string().trim().min(1, 'Search query is required').max(200),
    status: z.nativeEnum(DocumentStatus).optional(),
    tags: z.union([z.string(), z.array(z.string())]).optional(),
    page: z
      .string()
      .transform((v) => parseInt(v, 10))
      .refine((v) => !isNaN(v) && v >= 1)
      .optional(),
    limit: z
      .string()
      .transform((v) => parseInt(v, 10))
      .refine((v) => !isNaN(v) && v >= 1 && v <= 100)
      .optional(),
  }),
});

// ─── Version schemas ──────────────────────────────────────────────────────────

export const versionParamSchema = z.object({
  params: z.object({
    id: mongoIdSchema,
    version: z
      .string()
      .transform((v) => parseInt(v, 10))
      .refine((v) => !isNaN(v) && v >= 1, 'Version must be a positive integer'),
  }),
});

export const compareVersionsSchema = z.object({
  params: z.object({
    id: mongoIdSchema,
  }),
  query: z.object({
    v1: z
      .string()
      .transform((v) => parseInt(v, 10))
      .refine((v) => !isNaN(v) && v >= 1, 'v1 must be a positive integer'),
    v2: z
      .string()
      .transform((v) => parseInt(v, 10))
      .refine((v) => !isNaN(v) && v >= 1, 'v2 must be a positive integer'),
  }),
});

// ─── Comment schemas ──────────────────────────────────────────────────────────

export const createCommentSchema = z.object({
  params: z.object({
    id: mongoIdSchema,
  }),
  body: z.object({
    content: z
      .string()
      .trim()
      .min(1, 'Comment content is required')
      .max(10000, 'Comment must not exceed 10000 characters'),
    parentId: mongoIdSchema.optional(),
  }),
});

export const updateCommentSchema = z.object({
  params: z.object({
    id: mongoIdSchema,
    commentId: mongoIdSchema,
  }),
  body: z.object({
    content: z.string().trim().min(1).max(10000),
  }),
});

export const commentIdParamSchema = z.object({
  params: z.object({
    id: mongoIdSchema,
    commentId: mongoIdSchema,
  }),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type DocumentQueryInput = z.infer<typeof documentQuerySchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
