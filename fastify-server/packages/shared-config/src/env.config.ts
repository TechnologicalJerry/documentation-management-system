import { cleanEnv, str, num, bool, makeValidator } from 'envalid';
import dotenv from 'dotenv';

dotenv.config();

const commaSeparated = makeValidator<string[]>((input: string) => {
  if (!input) return [];
  return input.split(',').map((s) => s.trim()).filter(Boolean);
});

export type NodeEnv = 'development' | 'test' | 'production';

/**
 * Validates and parses all environment variables.
 * Will throw an error on startup if required variables are missing.
 */
export const env = cleanEnv(process.env, {
  // Application
  NODE_ENV: str({ choices: ['development', 'test', 'production'], default: 'development' }),
  PORT: num({ default: 3000 }),
  SERVICE_NAME: str({ default: 'devdocs-service' }),
  LOG_LEVEL: str({ choices: ['error', 'warn', 'info', 'http', 'debug'], default: 'info' }),

  // Database (PostgreSQL via Prisma)
  DATABASE_URL: str({ devDefault: 'postgresql://devdocs:devdocs@localhost:5432/devdocs' }),

  // Redis
  REDIS_URL: str({ devDefault: 'redis://localhost:6379' }),
  REDIS_PASSWORD: str({ default: '' }),

  // RabbitMQ
  RABBITMQ_URL: str({ devDefault: 'amqp://devdocs:devdocs@localhost:5672' }),
  RABBITMQ_VHOST: str({ default: '/' }),

  // JWT
  JWT_SECRET: str({ devDefault: 'dev-secret-change-in-production-minimum-32-chars' }),
  JWT_ACCESS_EXPIRY: str({ default: '15m' }),
  JWT_REFRESH_EXPIRY: str({ default: '7d' }),
  JWT_REFRESH_SECRET: str({ devDefault: 'dev-refresh-secret-change-in-production-minimum-32' }),

  // CORS
  CORS_ORIGINS: commaSeparated({ devDefault: ['http://localhost:3000', 'http://localhost:5173'] }),

  // File Storage (MinIO / S3-compatible)
  MINIO_ENDPOINT: str({ default: 'localhost' }),
  MINIO_PORT: num({ default: 9000 }),
  MINIO_USE_SSL: bool({ default: false }),
  MINIO_ACCESS_KEY: str({ devDefault: 'minioadmin' }),
  MINIO_SECRET_KEY: str({ devDefault: 'minioadmin' }),
  MINIO_BUCKET_NAME: str({ default: 'devdocs-files' }),

  // Email (SMTP)
  SMTP_HOST: str({ devDefault: 'localhost' }),
  SMTP_PORT: num({ default: 587 }),
  SMTP_SECURE: bool({ default: false }),
  SMTP_USER: str({ default: '' }),
  SMTP_PASS: str({ default: '' }),
  EMAIL_FROM: str({ default: 'noreply@devdocs.studio' }),
  EMAIL_FROM_NAME: str({ default: 'DevDocs Studio' }),

  // Feature flags
  ENABLE_EMAIL_VERIFICATION: bool({ default: true }),
  ENABLE_RATE_LIMITING: bool({ default: true }),
  ENABLE_AUDIT_LOGGING: bool({ default: true }),
  ENABLE_AI_FEATURES: bool({ default: false }),
});

export type Env = typeof env;
