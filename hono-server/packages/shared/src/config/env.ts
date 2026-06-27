import 'dotenv/config';

import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  RESET_PASSWORD_TOKEN_TTL_MINUTES: z.coerce.number().int().min(5).max(120).default(30),
  USER_SERVICE_URL: z.string().optional(),
  AUTH_SERVICE_URL: z.string().optional(),
  CHAT_SERVICE_URL: z.string().optional(),
  REALTIME_SERVICE_URL: z.string().optional()
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast so the app never boots with broken runtime configuration.
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const env = parsed.data;
