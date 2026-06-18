import { createApp } from './app';
import { config } from './config';
import { logger } from './lib/logger';
import { connectMongoDB, disconnectMongoDB } from './lib/mongoose';

async function bootstrap(): Promise<void> {
  try {
    await connectMongoDB();

    const app = createApp();

    const server = app.listen(config.app.port, () => {
      logger.info(`File Service running on port ${config.app.port}`, {
        env: config.app.nodeEnv,
        service: config.app.serviceName,
        storageProvider: config.storage.provider,
      });
    });

    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}. Shutting down file service gracefully...`);

      server.close(async () => {
        logger.info('HTTP server closed');
        await disconnectMongoDB();
        logger.info('Database connection closed');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Graceful shutdown timed out. Forcing exit.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));

    process.on('uncaughtException', (err: Error) => {
      logger.error('Uncaught exception', { error: err.message, stack: err.stack });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason: unknown) => {
      logger.error('Unhandled rejection', { reason });
      process.exit(1);
    });
  } catch (err) {
    logger.error('Failed to start file service', { error: err });
    process.exit(1);
  }
}

void bootstrap();
