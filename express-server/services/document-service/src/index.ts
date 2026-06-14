import 'dotenv/config';
import { createApp } from './app';
import { connectMongoDB } from './lib/mongoose';
import { DocumentPublisher } from './events/document.publisher';
import { logger } from './lib/logger';
import { config } from './config';

async function bootstrap(): Promise<void> {
  logger.info(`Starting ${config.app.serviceName}`, {
    env: config.app.nodeEnv,
    port: config.app.port,
  });

  // ── Connect to MongoDB ─────────────────────────────────────────────────────
  await connectMongoDB();

  // ── Initialise event publisher (no-op when RABBITMQ_URL not set) ──────────
  //
  // In a real project this would call:
  //   const eventBusClient = await EventBusClientFactory.create(config.rabbitmq);
  // For now we pass null so the service boots without RabbitMQ in dev.
  const publisher = new DocumentPublisher(null);

  // ── Build Express app ─────────────────────────────────────────────────────
  const app = createApp(publisher);

  // ── Start HTTP server ──────────────────────────────────────────────────────
  const server = app.listen(config.app.port, () => {
    logger.info(`${config.app.serviceName} listening on port ${config.app.port}`);
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = (signal: string): void => {
    logger.info(`Received ${signal}. Shutting down gracefully…`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force close after 10 s
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err: Error) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled rejection', { reason });
    process.exit(1);
  });
}

bootstrap().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error:', message);
  process.exit(1);
});
