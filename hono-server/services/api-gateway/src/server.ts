import { serve } from '@hono/node-server';
import { env } from '@hono-server/shared/src/config/env';
import { logger } from '@hono-server/shared/src/config/logger';
import app from './index';

async function bootstrap() {
  const port = env.PORT || 3000;

  const server = serve({
    fetch: app.fetch,
    port: Number(port)
  });

  logger.info(`API Gateway listening on port ${port}`);

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
  logger.error('Failed to bootstrap API Gateway', {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
