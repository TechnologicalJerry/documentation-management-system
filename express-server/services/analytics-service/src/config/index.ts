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
    name: 'analytics-service',
    port: numberFromEnv('PORT', 3011),
    env: process.env['NODE_ENV'] ?? 'development',
    isProduction: process.env['NODE_ENV'] === 'production',
  },
  mysql: {
    host: process.env['MYSQL_HOST'] ?? 'localhost',
    port: numberFromEnv('MYSQL_PORT', 3306),
    database: process.env['MYSQL_DATABASE'] ?? 'devdocs_analytics',
    user: process.env['MYSQL_USER'] ?? 'root',
    password: process.env['MYSQL_PASSWORD'] ?? 'password',
    connectionLimit: numberFromEnv('MYSQL_CONNECTION_LIMIT', 10),
  },
  cors: {
    origins: (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:3000,http://localhost:4200')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },
  rateLimit: {
    windowMs: numberFromEnv('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    maxRequests: numberFromEnv('RATE_LIMIT_MAX_REQUESTS', 500),
  },
};
