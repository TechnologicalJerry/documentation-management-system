import 'dotenv/config';
import { createApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { prisma } from './lib/prisma';
import { UserEventConsumer } from './events/user.consumer';

async function bootstrap(): Promise<void> {
  try {
    // Verify database connection
    await prisma.$connect();
    logger.info('Database connection established');

    const app = createApp();

    // Start HTTP server
    const server = app.listen(config.port, () => {
      logger.info(`User Service running on port ${config.port}`, {
        env: config.nodeEnv,
        service: config.serviceName,
      });
    });

    // Start event consumer (non-fatal if RabbitMQ is unavailable)
    const consumer = new UserEventConsumer();
    await consumer.connect();
    await consumer.startConsuming();

    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}. Shutting down user service gracefully...`);

      server.close(async () => {
        logger.info('HTTP server closed');
        await consumer.disconnect();
        await prisma.$disconnect();
        logger.info('All connections closed');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Graceful shutdown timed out. Forcing exit.');
        process.exit(1);
      }, 10_000);
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
    logger.error('Failed to start user service', { error: err });
    process.exit(1);
  }
}

void bootstrap();
