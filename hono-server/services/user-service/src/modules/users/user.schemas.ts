import { z } from 'zod';

import { USER_ROLES } from '@hono-server/shared/src/types/user.roles';

export const objectIdSchema = z.string().uuid('Invalid user id format');

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  role: z.enum(USER_ROLES).optional()
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    email: z.string().trim().email().max(255).optional(),
    password: z.string().min(8).max(128).optional(),
    role: z.enum(USER_ROLES).optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field is required for update'
  });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
