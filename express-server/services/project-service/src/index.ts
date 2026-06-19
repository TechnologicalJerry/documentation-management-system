import { createApp } from './app';
import { config } from './config';
import { connectDatabase, disconnectDatabase } from './lib/prisma';
import { logger } from './lib/logger';
import { ProjectPublisher } from './events/project.publisher';
import { ProjectConsumer } from './events/project.consumer';

const publisher = new ProjectPublisher();
const consumer = new ProjectConsumer();

async function bootstrap(): Promise<void> {
  // 1. Connect to database
  await connectDatabase();

  // 2. Connect to message broker (non-fatal — service can run without it)
  try {
    await publisher.connect();
    await consumer.connect();
    await consumer.startConsuming();
    logger.info('Message broker connected');
  } catch (error) {
    logger.warn('Message broker unavailable — events will be skipped', { error });
  }

  // 3. Start HTTP server
  const app = createApp();
  const server = app.listen(config.app.port, () => {
    logger.info(`${config.app.serviceName} listening on port ${config.app.port}`, {
      env: config.app.nodeEnv,
      port: config.app.port,
    });
  });

  // ─── Graceful Shutdown ───────────────────────────────────────────────────────

  const gracefulShutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — starting graceful shutdown`);

    server.close(async () => {
      try {
        await publisher.disconnect();
        await consumer.disconnect();
        await disconnectDatabase();
        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', { error });
        process.exit(1);
      }
    });

    // Force exit if shutdown takes too long
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    process.exit(1);
  });
}

bootstrap().catch((error) => {
  logger.error('Failed to start service', { error });
  process.exit(1);
});
