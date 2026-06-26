import dotenv from 'dotenv';

dotenv.config();

function numberFromEnv(key: string, fallback: number): number {
  const value = process.env[key];
  if (!value) {return fallback;}
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  app: {
    name: 'auth-service',
    port: numberFromEnv('PORT', 3001),
    env: process.env['NODE_ENV'] ?? 'development',
    isProduction: process.env['NODE_ENV'] === 'production',
  },
  cors: {
    origins: (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:3000,http://localhost:4200')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },
  jwt: {
    secret: process.env['JWT_SECRET'] ?? 'change_me_in_production',
    accessExpiry: process.env['JWT_ACCESS_EXPIRY'] ?? '15m',
    refreshExpiryDays: numberFromEnv('JWT_REFRESH_EXPIRY_DAYS', 7),
  },
  rateLimit: {
    windowMs: numberFromEnv('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    maxRequests: numberFromEnv('RATE_LIMIT_MAX_REQUESTS', 300),
  },
};
