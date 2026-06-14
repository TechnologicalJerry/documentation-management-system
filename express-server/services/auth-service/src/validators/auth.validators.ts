import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[0-9]/, 'Password must include a number');

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email().max(320).transform((value) => value.toLowerCase()),
    password: passwordSchema,
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    organizationName: z.string().max(160).optional(),
    inviteToken: z.string().optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email().transform((value) => value.toLowerCase()),
    password: z.string().min(1),
    rememberMe: z.boolean().optional(),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(32),
  }),
});

export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(32).optional(),
    logoutAllDevices: z.boolean().optional(),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
  }),
});
