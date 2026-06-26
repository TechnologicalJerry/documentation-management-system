import { config } from './config';
import { createApp } from './app';
import { prisma } from './lib/prisma';
import { logger } from './lib/logger';

const app = createApp();

app.listen({ port: config.app.port, host: '0.0.0.0' }, (err) => {
  if (err) {
    logger.error('Failed to start Auth Service', { error: err.message });
    process.exit(1);
  }
  logger.info(`Auth Service listening on port ${config.app.port}`);
});

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down Auth Service`);
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
