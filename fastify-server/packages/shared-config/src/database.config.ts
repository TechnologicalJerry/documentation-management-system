export interface DatabaseConfig {
  url: string;
  poolMin: number;
  poolMax: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
  queryTimeoutMs: number;
  enableLogging: boolean;
}

export interface RedisConfig {
  url: string;
  password?: string;
  db?: number;
  keyPrefix: string;
  retryAttempts: number;
  retryDelay: number;
  connectTimeout: number;
  maxRetriesPerRequest: number;
}

export function getDatabaseConfig(): DatabaseConfig {
  return {
    url: process.env['DATABASE_URL'] || 'postgresql://devdocs:devdocs@localhost:5432/devdocs',
    poolMin: parseInt(process.env['DB_POOL_MIN'] || '2', 10),
    poolMax: parseInt(process.env['DB_POOL_MAX'] || '10', 10),
    connectionTimeoutMs: parseInt(process.env['DB_CONNECT_TIMEOUT_MS'] || '5000', 10),
    idleTimeoutMs: parseInt(process.env['DB_IDLE_TIMEOUT_MS'] || '30000', 10),
    queryTimeoutMs: parseInt(process.env['DB_QUERY_TIMEOUT_MS'] || '10000', 10),
    enableLogging: process.env['NODE_ENV'] === 'development',
  };
}

export function getRedisConfig(): RedisConfig {
  return {
    url: process.env['REDIS_URL'] || 'redis://localhost:6379',
    password: process.env['REDIS_PASSWORD'] || undefined,
    db: parseInt(process.env['REDIS_DB'] || '0', 10),
    keyPrefix: process.env['REDIS_KEY_PREFIX'] || 'devdocs:',
    retryAttempts: parseInt(process.env['REDIS_RETRY_ATTEMPTS'] || '3', 10),
    retryDelay: parseInt(process.env['REDIS_RETRY_DELAY_MS'] || '1000', 10),
    connectTimeout: parseInt(process.env['REDIS_CONNECT_TIMEOUT_MS'] || '5000', 10),
    maxRetriesPerRequest: 3,
  };
}

export interface MinioConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucketName: string;
  region: string;
}

export function getMinioConfig(): MinioConfig {
  return {
    endPoint: process.env['MINIO_ENDPOINT'] || 'localhost',
    port: parseInt(process.env['MINIO_PORT'] || '9000', 10),
    useSSL: process.env['MINIO_USE_SSL'] === 'true',
    accessKey: process.env['MINIO_ACCESS_KEY'] || 'minioadmin',
    secretKey: process.env['MINIO_SECRET_KEY'] || 'minioadmin',
    bucketName: process.env['MINIO_BUCKET_NAME'] || 'devdocs-files',
    region: process.env['MINIO_REGION'] || 'us-east-1',
  };
}
