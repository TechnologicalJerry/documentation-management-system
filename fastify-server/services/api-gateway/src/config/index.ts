import dotenv from 'dotenv';

dotenv.config();

export interface UpstreamService {
  name: string;
  prefix: string;
  target: string;
  protected: boolean;
}

function numberFromEnv(key: string, fallback: number): number {
  const value = process.env[key];
  if (!value) {return fallback;}
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  app: {
    name: 'api-gateway',
    port: numberFromEnv('PORT', 3000),
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
  },
  rateLimit: {
    windowMs: numberFromEnv('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    maxRequests: numberFromEnv('RATE_LIMIT_MAX_REQUESTS', 1000),
  },
  proxy: {
    timeoutMs: numberFromEnv('PROXY_TIMEOUT_MS', 30000),
  },
};

export const upstreamServices: UpstreamService[] = [
  {
    name: 'auth-service',
    prefix: '/api/v1/auth',
    target: process.env['AUTH_SERVICE_URL'] ?? 'http://localhost:3001',
    protected: false,
  },
  {
    name: 'user-service',
    prefix: '/api/v1/users',
    target: process.env['USER_SERVICE_URL'] ?? 'http://localhost:3002',
    protected: true,
  },
  {
    name: 'project-service',
    prefix: '/api/v1/projects',
    target: process.env['PROJECT_SERVICE_URL'] ?? 'http://localhost:3003',
    protected: true,
  },
  {
    name: 'document-service',
    prefix: '/api/v1/documents',
    target: process.env['DOCUMENT_SERVICE_URL'] ?? 'http://localhost:3004',
    protected: true,
  },
  {
    name: 'template-service',
    prefix: '/api/v1/templates',
    target: process.env['TEMPLATE_SERVICE_URL'] ?? 'http://localhost:3005',
    protected: true,
  },
  {
    name: 'ai-service',
    prefix: '/api/v1/ai',
    target: process.env['AI_SERVICE_URL'] ?? 'http://localhost:3006',
    protected: true,
  },
  {
    name: 'export-service',
    prefix: '/api/v1/exports',
    target: process.env['EXPORT_SERVICE_URL'] ?? 'http://localhost:3007',
    protected: true,
  },
  {
    name: 'file-service',
    prefix: '/api/v1/files',
    target: process.env['FILE_SERVICE_URL'] ?? 'http://localhost:3008',
    protected: true,
  },
  {
    name: 'notification-service',
    prefix: '/api/v1/notifications',
    target: process.env['NOTIFICATION_SERVICE_URL'] ?? 'http://localhost:3009',
    protected: true,
  },
  {
    name: 'audit-service',
    prefix: '/api/v1/audit',
    target: process.env['AUDIT_SERVICE_URL'] ?? 'http://localhost:3010',
    protected: true,
  },
  {
    name: 'analytics-service',
    prefix: '/api/v1/analytics',
    target: process.env['ANALYTICS_SERVICE_URL'] ?? 'http://localhost:3011',
    protected: true,
  },
];
