import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { logger } from './logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log:
      config.app.isDevelopment
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'info' },
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ]
        : [
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ],
    errorFormat: config.app.isDevelopment ? 'pretty' : 'minimal',
  });

  if (config.app.isDevelopment) {
    client.$on('query', (e) => {
      logger.debug('Prisma Query', {
        query: e.query,
        params: e.params,
        duration: `${e.duration}ms`,
      });
    });
  }

  client.$on('warn', (e) => {
    logger.warn('Prisma Warning', { message: e.message });
  });

  client.$on('error', (e) => {
    logger.error('Prisma Error', { message: e.message });
  });

  return client;
}

// Prevent multiple instances in development (hot reload)
export const prisma: PrismaClient =
  config.app.isTest
    ? createPrismaClient()
    : (global.__prisma ?? (global.__prisma = createPrismaClient()));

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error('Failed to disconnect from database', { error });
    throw error;
  }
}
