import { serve } from '@hono/node-server';
import { env } from '@hono-server/shared/src/config/env';
import { logger } from '@hono-server/shared/src/config/logger';
import app from './index';

async function bootstrap() {
  const port = env.PORT ? Number(env.PORT) + 1 : 3001; // Port 3001

  const server = serve({
    fetch: app.fetch,
    port
  });

  logger.info(`Auth service listening on port ${port}`);

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  logger.error('Failed to bootstrap auth service', {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
