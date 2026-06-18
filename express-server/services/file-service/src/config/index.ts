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

export type StorageProvider = 'local' | 's3';

export const config = {
  app: {
    nodeEnv: optionalEnv('NODE_ENV', 'development'),
    port: optionalEnvInt('PORT', 3008),
    serviceName: optionalEnv('SERVICE_NAME', 'file-service'),
    baseUrl: optionalEnv('BASE_URL', 'http://localhost:3009'),
    isProduction: optionalEnv('NODE_ENV', 'development') === 'production',
    isTest: optionalEnv('NODE_ENV', 'development') === 'test',
  },
  mongodb: {
    uri: optionalEnv('MONGODB_URI', 'mongodb://localhost:27017/devdocs_files'),
    poolSize: optionalEnvInt('MONGODB_POOL_SIZE', 10),
    connectTimeoutMs: optionalEnvInt('MONGODB_CONNECT_TIMEOUT_MS', 10000),
    socketTimeoutMs: optionalEnvInt('MONGODB_SOCKET_TIMEOUT_MS', 45000),
  },
  jwt: {
    secret: requireEnv('JWT_SECRET'),
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
  rabbitmq: {
    url: optionalEnv('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672'),
    exchange: optionalEnv('RABBITMQ_EXCHANGE', 'devdocs.events'),
    queue: optionalEnv('RABBITMQ_QUEUE', 'file-service-queue'),
  },
  logging: {
    level: optionalEnv('LOG_LEVEL', 'debug'),
    format: optionalEnv('LOG_FORMAT', 'json'),
  },
  storage: {
    provider: optionalEnv('STORAGE_PROVIDER', 'local') as StorageProvider,
    localPath: optionalEnv('LOCAL_STORAGE_PATH', '/var/uploads'),
  },
  aws: {
    region: optionalEnv('AWS_REGION', 'us-east-1'),
    accessKeyId: optionalEnv('AWS_ACCESS_KEY_ID', ''),
    secretAccessKey: optionalEnv('AWS_SECRET_ACCESS_KEY', ''),
    s3Bucket: optionalEnv('AWS_S3_BUCKET', 'devdocs-files'),
  },
  upload: {
    maxFileSizeMb: optionalEnvInt('MAX_FILE_SIZE_MB', 100),
    allowedFileTypes: optionalEnv(
      'ALLOWED_FILE_TYPES',
      'image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,text/markdown',
    )
      .split(',')
      .map((t) => t.trim()),
  },
  thumbnail: {
    width: optionalEnvInt('THUMBNAIL_WIDTH', 320),
    height: optionalEnvInt('THUMBNAIL_HEIGHT', 240),
    quality: optionalEnvInt('THUMBNAIL_QUALITY', 80),
  },
  pagination: {
    defaultPageSize: optionalEnvInt('DEFAULT_PAGE_SIZE', 20),
    maxPageSize: optionalEnvInt('MAX_PAGE_SIZE', 100),
  },
} as const;

export type Config = typeof config;
