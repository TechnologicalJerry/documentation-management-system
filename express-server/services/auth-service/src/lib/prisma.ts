import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

declare global {
  // eslint-disable-next-line no-var
  var __authPrisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });

  client.$on('error', (event) => {
    logger.error('Prisma error', { message: event.message, target: event.target });
  });

  client.$on('warn', (event) => {
    logger.warn('Prisma warning', { message: event.message, target: event.target });
  });

  return client;
}

export const prisma: PrismaClient =
  process.env['NODE_ENV'] === 'production'
    ? createPrismaClient()
    : (global.__authPrisma ??= createPrismaClient());
