import { config } from './config';
import { createApp } from './app';
import { logger } from './lib/logger';

const app = createApp();

app.listen({ port: config.app.port, host: '0.0.0.0' }, (err) => {
  if (err) {
    logger.error('Failed to start API Gateway', { error: err.message });
    process.exit(1);
  }
  logger.info(`API Gateway listening on port ${config.app.port}`);
});

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down API Gateway`);
  await app.close();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
