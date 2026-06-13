import { createServer } from 'http';
import { config } from './config';
import { createApp } from './app';
import { prisma } from './lib/prisma';
import { logger } from './lib/logger';

const app = createApp();
const server = createServer(app);

server.listen(config.app.port, () => {
  logger.info(`Auth Service listening on port ${config.app.port}`);
});

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down Auth Service`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
