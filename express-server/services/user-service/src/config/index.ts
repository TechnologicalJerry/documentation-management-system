interface ServiceConfig {
  nodeEnv: string;
  port: number;
  serviceName: string;
  logLevel: string;
  database: {
    url: string;
  };
  rabbitmq: {
    url: string;
  };
  jwt: {
    secret: string;
    accessExpiry: string;
  };
  fileService: {
    url: string;
  };
  avatar: {
    maxSizeMb: number;
    allowedMimeTypes: string[];
  };
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function getEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function getEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) {return defaultValue;}
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid integer`);
  }

  return parsed;
}

export const config: ServiceConfig = {
  nodeEnv: getEnv('NODE_ENV', 'development'),
  port: getEnvInt('PORT', 3002),
  serviceName: getEnv('SERVICE_NAME', 'user-service'),
  logLevel: getEnv('LOG_LEVEL', 'info'),
  database: {
    url: requireEnv('DATABASE_URL'),
  },
  rabbitmq: {
    url: getEnv('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672'),
  },
  jwt: {
    secret: getEnv('JWT_SECRET', 'fallback-dev-secret-do-not-use-in-production'),
    accessExpiry: getEnv('JWT_ACCESS_EXPIRY', '15m'),
  },
  fileService: {
    url: getEnv('FILE_SERVICE_URL', 'http://localhost:3009'),
  },
  avatar: {
    maxSizeMb: getEnvInt('MAX_AVATAR_SIZE_MB', 5),
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },
};
