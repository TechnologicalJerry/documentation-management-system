import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function optionalEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid integer, got: ${value}`);
  }

  return parsed;
}

export const config = {
  app: {
    nodeEnv: optionalEnv('NODE_ENV', 'development'),
    port: optionalEnvInt('PORT', 3003),
    serviceName: optionalEnv('SERVICE_NAME', 'project-service'),
    isProduction: optionalEnv('NODE_ENV', 'development') === 'production',
    isDevelopment: optionalEnv('NODE_ENV', 'development') === 'development',
    isTest: optionalEnv('NODE_ENV', 'development') === 'test',
  },
  database: {
    url: requireEnv('DATABASE_URL'),
  },
  jwt: {
    secret: requireEnv('JWT_SECRET'),
    issuer: optionalEnv('JWT_ISSUER', 'devdocs-auth-service'),
  },
  rabbitmq: {
    url: optionalEnv('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672'),
    exchange: optionalEnv('RABBITMQ_EXCHANGE', 'devdocs.events'),
    queues: {
      project: optionalEnv('RABBITMQ_QUEUE_PROJECT', 'project-service.events'),
      user: optionalEnv('RABBITMQ_QUEUE_USER', 'user-service.events'),
    },
  },
  rateLimit: {
    windowMs: optionalEnvInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    max: optionalEnvInt('RATE_LIMIT_MAX_REQUESTS', 100),
  },
  cors: {
    origins: optionalEnv('CORS_ORIGINS', 'http://localhost:4200,http://localhost:3000')
      .split(',')
      .map((o) => o.trim()),
  },
  invitation: {
    expiryHours: optionalEnvInt('INVITATION_EXPIRY_HOURS', 72),
    baseUrl: optionalEnv('INVITATION_BASE_URL', 'http://localhost:4200'),
  },
  logging: {
    level: optionalEnv('LOG_LEVEL', 'info'),
    format: optionalEnv('LOG_FORMAT', 'json'),
  },
} as const;

export type Config = typeof config;
