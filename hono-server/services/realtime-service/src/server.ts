import http from 'node:http';
import { env } from '@hono-server/shared/src/config/env';
import { logger } from '@hono-server/shared/src/config/logger';
import { createRealtimeServer } from './index';

async function bootstrap() {
  const port = env.PORT ? Number(env.PORT) + 3 : 3003; // Port 3003

  const httpServer = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Realtime Service is running.');
  });

  createRealtimeServer(httpServer);

  httpServer.listen(port, () => {
    logger.info(`Realtime service listening on port ${port}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    httpServer.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  logger.error('Failed to bootstrap realtime service', {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
