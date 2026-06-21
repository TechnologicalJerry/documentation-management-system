import { z } from 'zod';
import { OrganizationPlan, TeamMemberRole, Theme } from '../types/user.types';

// ─── Common Schemas ───────────────────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const uuidSchema = z.string().uuid('Invalid UUID format');

// ─── User Validators ──────────────────────────────────────────────────────────

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  firstName: z.string().min(1, 'First name is required').max(100).trim(),
  lastName: z.string().min(1, 'Last name is required').max(100).trim(),
  displayName: z.string().max(150).trim().optional(),
  bio: z.string().max(500).trim().optional(),
  avatar: z.string().url('Invalid avatar URL').optional(),
  timezone: z.string().max(100).default('UTC'),
  language: z.string().length(2, 'Language must be a 2-character ISO code').default('en'),
  organizationId: uuidSchema.optional(),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName: z.string().min(1).max(100).trim().optional(),
  displayName: z.string().max(150).trim().nullable().optional(),
  bio: z.string().max(500).trim().nullable().optional(),
  timezone: z.string().max(100).optional(),
  language: z.string().length(2).optional(),
  isActive: z.boolean().optional(),
  organizationId: uuidSchema.nullable().optional(),
});

export const userQuerySchema = paginationSchema.extend({
  search: z.string().min(1).max(200).trim().optional(),
  organizationId: uuidSchema.optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'true') {return true;}
      if (val === 'false') {return false;}

      return undefined;
    }),
  teamId: uuidSchema.optional(),
  language: z.string().length(2).optional(),
  timezone: z.string().max(100).optional(),
  sortBy: z
    .enum(['createdAt', 'firstName', 'lastName', 'email', 'updatedAt'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const userSearchSchema = paginationSchema.extend({
  q: z.string().min(2, 'Search query must be at least 2 characters').max(200).trim(),
});

export const updateUserPreferencesSchema = z.object({
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  theme: z.nativeEnum(Theme).optional(),
  editorFontSize: z.number().int().min(8).max(32).optional(),
  editorTheme: z.string().min(1).max(50).optional(),
});

// ─── Organization Validators ──────────────────────────────────────────────────

export const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(200).trim(),
  slug: z
    .string()
    .min(2)
    .max(100)
    .toLowerCase()
    .regex(
      /^[a-z0-9-]+$/,
      'Slug must contain only lowercase letters, numbers, and hyphens',
    ),
  description: z.string().max(1000).trim().optional(),
  logo: z.string().url('Invalid logo URL').optional(),
  website: z.string().url('Invalid website URL').optional(),
  plan: z.nativeEnum(OrganizationPlan).default(OrganizationPlan.FREE),
  maxMembers: z.number().int().min(1).max(10000).default(5),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(200).trim().optional(),
  description: z.string().max(1000).trim().nullable().optional(),
  logo: z.string().url('Invalid logo URL').nullable().optional(),
  website: z.string().url('Invalid website URL').nullable().optional(),
  plan: z.nativeEnum(OrganizationPlan).optional(),
  maxMembers: z.number().int().min(1).max(10000).optional(),
  isActive: z.boolean().optional(),
});

export const organizationQuerySchema = paginationSchema.extend({
  search: z.string().min(1).max(200).trim().optional(),
  plan: z.nativeEnum(OrganizationPlan).optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'true') {return true;}
      if (val === 'false') {return false;}

      return undefined;
    }),
  sortBy: z.enum(['createdAt', 'name', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const inviteMemberSchema = z.object({
  userId: uuidSchema,
});

// ─── Team Validators ──────────────────────────────────────────────────────────

export const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(200).trim(),
  description: z.string().max(500).trim().optional(),
  organizationId: uuidSchema,
});

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(500).trim().nullable().optional(),
});

export const addTeamMemberSchema = z.object({
  userId: uuidSchema,
  role: z.nativeEnum(TeamMemberRole).default(TeamMemberRole.MEMBER),
});

export const updateTeamMemberRoleSchema = z.object({
  role: z.nativeEnum(TeamMemberRole),
});

export const teamQuerySchema = paginationSchema.extend({
  search: z.string().min(1).max(200).trim().optional(),
  sortBy: z.enum(['createdAt', 'name', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ─── Type Exports ─────────────────────────────────────────────────────────────

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserQueryInput = z.infer<typeof userQuerySchema>;
export type UpdateUserPreferencesInput = z.infer<typeof updateUserPreferencesSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type OrganizationQueryInput = z.infer<typeof organizationQuerySchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;
export type TeamQueryInput = z.infer<typeof teamQuerySchema>;
