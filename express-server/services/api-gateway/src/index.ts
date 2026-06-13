import { createServer } from 'http';
import { config } from './config';
import { createApp } from './app';
import { logger } from './lib/logger';

const app = createApp();
const server = createServer(app);

server.listen(config.app.port, () => {
  logger.info(`API Gateway listening on port ${config.app.port}`);
});

function shutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down API Gateway`);
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
