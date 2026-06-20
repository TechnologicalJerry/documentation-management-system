import { MemberRole, ProjectStatus, ProjectVisibility } from '@prisma/client';
import { z } from 'zod';

// ─── Tag Schemas ─────────────────────────────────────────────────────────────

export const createTagSchema = z.object({
  name: z
    .string()
    .min(1, 'Tag name is required')
    .max(50, 'Tag name must not exceed 50 characters')
    .trim(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (e.g. #6366f1)')
    .optional()
    .default('#6366f1'),
});

// ─── Project Settings Schema ─────────────────────────────────────────────────

export const projectSettingsSchema = z.object({
  defaultDocumentStatus: z
    .enum(['DRAFT', 'REVIEW', 'PUBLISHED'])
    .optional()
    .default('DRAFT'),
  allowPublicComments: z.boolean().optional().default(false),
  enableVersioning: z.boolean().optional().default(true),
  autoSaveInterval: z
    .number()
    .int()
    .min(10, 'Auto-save interval must be at least 10 seconds')
    .max(300, 'Auto-save interval must not exceed 300 seconds')
    .optional()
    .default(30),
});

// ─── Project CRUD Schemas ────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must not exceed 100 characters')
    .trim(),
  description: z
    .string()
    .max(1000, 'Description must not exceed 1000 characters')
    .trim()
    .optional(),
  visibility: z.nativeEnum(ProjectVisibility).optional().default(ProjectVisibility.PRIVATE),
  organizationId: z.string().uuid('Invalid organization ID').optional(),
  coverImage: z.string().url('Cover image must be a valid URL').optional(),
  tags: z.array(createTagSchema).max(20, 'Cannot have more than 20 tags').optional().default([]),
  settings: projectSettingsSchema.optional(),
});

export const updateProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must not exceed 100 characters')
    .trim()
    .optional(),
  description: z
    .string()
    .max(1000, 'Description must not exceed 1000 characters')
    .trim()
    .nullable()
    .optional(),
  visibility: z.nativeEnum(ProjectVisibility).optional(),
  coverImage: z.string().url('Cover image must be a valid URL').nullable().optional(),
  tags: z.array(createTagSchema).max(20, 'Cannot have more than 20 tags').optional(),
  settings: projectSettingsSchema.partial().optional(),
});

export const projectQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  visibility: z.nativeEnum(ProjectVisibility).optional(),
  organizationId: z.string().uuid().optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  tags: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),
});

// ─── Member Schemas ───────────────────────────────────────────────────────────

export const addMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: z.nativeEnum(MemberRole).refine(
    (role) => role !== MemberRole.OWNER,
    'Cannot directly assign OWNER role',
  ),
});

export const updateMemberSchema = z.object({
  role: z.nativeEnum(MemberRole).refine(
    (role) => role !== MemberRole.OWNER,
    'Cannot change role to OWNER',
  ),
});

export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  role: z.nativeEnum(MemberRole).refine(
    (role) => role !== MemberRole.OWNER,
    'Cannot invite as OWNER',
  ),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
});

// ─── Path param schemas ───────────────────────────────────────────────────────

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
});

export const memberIdParamSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  userId: z.string().uuid('Invalid user ID'),
});

// ─── Exported types ───────────────────────────────────────────────────────────

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectQueryInput = z.infer<typeof projectQuerySchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
