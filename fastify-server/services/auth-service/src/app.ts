import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { apiRouter } from './routes';
import { errorHandler } from '@devdocs/shared-middleware';
import { logger } from './lib/logger';
import { requestId, correlationId } from '@devdocs/shared-middleware';

export function createApp(): FastifyInstance {
  const app = Fastify({
    logger: false,
    trustProxy: true,
  });

  // Global hooks for request tracing
  app.addHook('onRequest', requestId);
  app.addHook('onRequest', correlationId);

  // Security & Utility Plugins
  app.register(helmet);
  app.register(compress);
  app.register(cors, {
    origin: config.app.isProduction ? config.cors.origins : true,
    credentials: true,
  });

  app.register(rateLimit as any, {
    timeWindow: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
  });

  // Request logger
  app.addHook('onRequest', async (request) => {
    logger.debug('Auth request', { method: request.method, url: request.url });
  });

  // Register Routes
  app.register(apiRouter, { prefix: '/api/v1' });

  // Health check route (registered globally as well as inside route prefix in router)
  app.get('/health', async () => {
    return { service: 'auth-service', status: 'healthy', timestamp: new Date().toISOString() };
  });

  // Global Error and Not Found Handlers
  app.setErrorHandler(errorHandler({ logger }));

  app.setNotFoundHandler(async (request, reply) => {
    reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} was not found`,
      },
      requestId: request.requestId,
    });
  });

  return app;
}
