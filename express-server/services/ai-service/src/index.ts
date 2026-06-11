import 'dotenv/config';
import { createApp } from './app';
import { config } from './config';
import { logger } from './lib/logger';
import { connectMongoDB, disconnectMongoDB } from './lib/mongoose';
import { GenerationService } from './services/generation.service';
import { AIConsumer } from './events/ai.consumer';

async function bootstrap(): Promise<void> {
  try {
    // Connect to MongoDB
    await connectMongoDB();

    // Initialise services
    const generationService = new GenerationService();

    // Start the event consumer
    const consumer = new AIConsumer(generationService);
    await consumer.start();

    // Create and start HTTP server
    const app = createApp();

    const server = app.listen(config.app.port, () => {
      logger.info(`AI Service running on port ${config.app.port}`, {
        env: config.app.nodeEnv,
        service: config.app.serviceName,
        provider: config.ai.provider,
        maxConcurrent: config.ai.maxConcurrentGenerations,
      });
    });

    // ---------------------------------------------------------------------------
    // Graceful shutdown
    // ---------------------------------------------------------------------------
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}. Shutting down AI Service gracefully...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await consumer.stop();
          await disconnectMongoDB();
          logger.info('Graceful shutdown complete');
          process.exit(0);
        } catch (err) {
          logger.error('Error during graceful shutdown', { error: err });
          process.exit(1);
        }
      });

      // Force exit if graceful shutdown takes too long
      setTimeout(() => {
        logger.error('Graceful shutdown timed out. Forcing exit.');
        process.exit(1);
      }, 15_000);
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
    logger.error('Failed to start AI Service', { error: err });
    process.exit(1);
  }
}

void bootstrap();
