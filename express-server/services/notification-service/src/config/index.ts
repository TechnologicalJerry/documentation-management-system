import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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
  const raw = process.env[key];
  if (raw === undefined || raw === '') {
    return defaultValue;
  }
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid integer, got: ${raw}`);
  }

  return parsed;
}

function optionalEnvBool(key: string, defaultValue: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === '') {return defaultValue;}

  return raw.toLowerCase() === 'true' || raw === '1';
}

export const config = {
  app: {
    nodeEnv: optionalEnv('NODE_ENV', 'development'),
    port: optionalEnvInt('PORT', 3009),
    serviceName: optionalEnv('SERVICE_NAME', 'notification-service'),
    isProduction: optionalEnv('NODE_ENV', 'development') === 'production',
    isDevelopment: optionalEnv('NODE_ENV', 'development') === 'development',
    isTest: optionalEnv('NODE_ENV', 'development') === 'test',
  },
  mysql: {
    host: optionalEnv('MYSQL_HOST', 'localhost'),
    port: optionalEnvInt('MYSQL_PORT', 3306),
    user: optionalEnv('MYSQL_USER', 'root'),
    password: optionalEnv('MYSQL_PASSWORD', 'password'),
    database: optionalEnv('MYSQL_DATABASE', 'devdocs_notifications'),
    connectionLimit: optionalEnvInt('MYSQL_CONNECTION_LIMIT', 10),
  },
  jwt: {
    secret: requireEnv('JWT_SECRET'),
  },
  rabbitmq: {
    url: optionalEnv('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672'),
    exchange: optionalEnv('RABBITMQ_EXCHANGE', 'devdocs.events'),
    queue: optionalEnv('RABBITMQ_QUEUE', 'notification-service-queue'),
  },
  smtp: {
    host: optionalEnv('SMTP_HOST', 'smtp.gmail.com'),
    port: optionalEnvInt('SMTP_PORT', 587),
    secure: optionalEnvBool('SMTP_SECURE', false),
    user: optionalEnv('SMTP_USER', ''),
    pass: optionalEnv('SMTP_PASS', ''),
    fromEmail: optionalEnv('FROM_EMAIL', 'noreply@devdocs.io'),
    fromName: optionalEnv('FROM_NAME', 'DevDocs Studio'),
  },
  rateLimit: {
    windowMs: optionalEnvInt('RATE_LIMIT_WINDOW_MS', 900000),
    maxRequests: optionalEnvInt('RATE_LIMIT_MAX_REQUESTS', 200),
  },
  cors: {
    origins: optionalEnv('CORS_ORIGIN', 'http://localhost:4200,http://localhost:3000')
      .split(',')
      .map((o) => o.trim()),
  },
  logging: {
    level: optionalEnv('LOG_LEVEL', 'debug'),
    format: optionalEnv('LOG_FORMAT', 'json'),
  },
  pagination: {
    defaultPageSize: optionalEnvInt('DEFAULT_PAGE_SIZE', 20),
    maxPageSize: optionalEnvInt('MAX_PAGE_SIZE', 100),
  },
} as const;

export type Config = typeof config;
