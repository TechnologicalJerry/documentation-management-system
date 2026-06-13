import { z } from 'zod';
import { TemplateCategory, TemplateType } from '../types/template.types';

export const templateVariableSchema = z.object({
  name: z
    .string()
    .min(1, 'Variable name is required')
    .max(100, 'Variable name must be at most 100 characters')
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Variable name must be a valid identifier'),
  description: z
    .string()
    .min(1, 'Variable description is required')
    .max(500, 'Variable description must be at most 500 characters'),
  defaultValue: z.string().max(1000).optional().default(''),
  required: z.boolean().default(false),
});

export const createTemplateSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(200, 'Name must be at most 200 characters')
      .trim(),
    description: z
      .string()
      .min(10, 'Description must be at least 10 characters')
      .max(1000, 'Description must be at most 1000 characters')
      .trim(),
    content: z
      .string()
      .min(1, 'Content is required')
      .max(524288, 'Content must be at most 512KB'),
    category: z.nativeEnum(TemplateCategory, {
      errorMap: () => ({ message: `Category must be one of: ${Object.values(TemplateCategory).join(', ')}` }),
    }),
    type: z
      .nativeEnum(TemplateType, {
        errorMap: () => ({ message: `Type must be one of: ${Object.values(TemplateType).join(', ')}` }),
      })
      .optional()
      .default(TemplateType.USER),
    organizationId: z.string().uuid('Organization ID must be a valid UUID').optional(),
    isPublic: z.boolean().optional().default(false),
    tags: z
      .array(z.string().min(1).max(50).trim())
      .max(20, 'At most 20 tags allowed')
      .optional()
      .default([]),
    variables: z.array(templateVariableSchema).max(50, 'At most 50 variables allowed').optional().default([]),
    previewImage: z.string().url('Preview image must be a valid URL').optional(),
    metadata: z.record(z.unknown()).optional().default({}),
  }),
});

export const updateTemplateSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Template ID is required'),
  }),
  body: z.object({
    name: z.string().min(2).max(200).trim().optional(),
    description: z.string().min(10).max(1000).trim().optional(),
    content: z.string().min(1).max(524288).optional(),
    category: z.nativeEnum(TemplateCategory).optional(),
    isPublic: z.boolean().optional(),
    isActive: z.boolean().optional(),
    tags: z.array(z.string().min(1).max(50).trim()).max(20).optional(),
    variables: z.array(templateVariableSchema).max(50).optional(),
    previewImage: z.string().url().optional().nullable(),
    metadata: z.record(z.unknown()).optional(),
    changelog: z.string().max(2000).optional(),
  }),
});

export const templateQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().min(1).default(1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20))
      .pipe(z.number().int().min(1).max(100).default(20)),
    category: z.nativeEnum(TemplateCategory).optional(),
    type: z.nativeEnum(TemplateType).optional(),
    search: z.string().max(200).trim().optional(),
    isPublic: z
      .string()
      .optional()
      .transform((val) => {
        if (val === 'true') {return true;}
        if (val === 'false') {return false;}

        return undefined;
      }),
    authorId: z.string().optional(),
    organizationId: z.string().optional(),
    tags: z
      .string()
      .optional()
      .transform((val) => (val ? val.split(',').map((t) => t.trim()).filter(Boolean) : undefined)),
    sortBy: z
      .enum(['createdAt', 'updatedAt', 'usageCount', 'rating', 'name'])
      .optional()
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});

export const applyTemplateSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Template ID is required'),
  }),
  body: z.object({
    variables: z.record(z.string()).default({}),
    documentTitle: z.string().max(200).optional(),
  }),
});

export const rateTemplateSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Template ID is required'),
  }),
  body: z.object({
    rating: z
      .number()
      .int('Rating must be an integer')
      .min(1, 'Rating must be at least 1')
      .max(5, 'Rating must be at most 5'),
    review: z.string().max(2000).optional(),
  }),
});

export const templateIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Template ID is required'),
  }),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>['body'];
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>['body'];
export type TemplateQueryInput = z.infer<typeof templateQuerySchema>['query'];
export type ApplyTemplateInput = z.infer<typeof applyTemplateSchema>['body'];
export type RateTemplateInput = z.infer<typeof rateTemplateSchema>['body'];
