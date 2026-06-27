import { serve } from '@hono/node-server';
import { env } from '@hono-server/shared/src/config/env';
import { logger } from '@hono-server/shared/src/config/logger';
import { connectToDatabase, disconnectDatabase } from '@hono-server/shared/src/db/mongoose';
import app from './index';

async function bootstrap() {
  await connectToDatabase();

  const port = env.PORT ? Number(env.PORT) + 4 : 3004;

  const server = serve({
    fetch: app.fetch,
    port
  });

  logger.info(`User service listening on port ${port}`);

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  logger.error('Failed to bootstrap user service', {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
