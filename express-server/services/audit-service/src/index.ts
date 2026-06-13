import { createServer } from 'http';
import { config } from './config';
import { createApp } from './app';
import { connectMongoDB, disconnectMongoDB } from './lib/mongoose';
import { logger } from './lib/logger';

async function bootstrap(): Promise<void> {
  await connectMongoDB();
  const app = createApp();
  const server = createServer(app);

  server.listen(config.app.port, () => {
    logger.info(`Audit Service listening on port ${config.app.port}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down Audit Service`);
    server.close(async () => {
      await disconnectMongoDB();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void bootstrap().catch((error) => {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error('Audit Service failed to start', { error: err.message, stack: err.stack });
  process.exit(1);
});
