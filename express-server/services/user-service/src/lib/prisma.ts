import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });

  // Log slow queries in development
  if (process.env['NODE_ENV'] !== 'production') {
    client.$on('query', (e) => {
      if (e.duration > 500) {
        logger.warn('Slow query detected', {
          query: e.query,
          duration: `${e.duration}ms`,
        });
      }
    });
  }

  client.$on('error', (e) => {
    logger.error('Prisma error', { message: e.message, target: e.target });
  });

  client.$on('warn', (e) => {
    logger.warn('Prisma warning', { message: e.message, target: e.target });
  });

  return client;
}

// Singleton pattern: reuse client in development to avoid exhausting DB connections
export const prisma: PrismaClient =
  process.env['NODE_ENV'] === 'production'
    ? createPrismaClient()
    : (global.__prisma ??= createPrismaClient());
