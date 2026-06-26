import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { config } from './config';
import { openApiDocument } from './docs/openapi';
import { healthRouter } from './routes/health.routes';
import { registerProxyRoutes } from './routes/proxy.routes';
import { logger } from './lib/logger';
import { requestId, correlationId } from '@devdocs/shared-middleware';

export function createApp(): FastifyInstance {
  const app = Fastify({
    logger: false,
    trustProxy: true,
  });

  // Global Hooks
  app.addHook('onRequest', requestId);
  app.addHook('onRequest', correlationId);

  // Security & Utility Plugins
  app.register(helmet, {
    contentSecurityPolicy: false, // Turn off CSP so Swagger UI loads successfully
  });
  app.register(compress);
  app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || !config.app.isProduction || config.cors.origins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
    },
    credentials: true,
  });

  app.register(rateLimit as any, {
    timeWindow: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    errorResponseOnly: true,
  });

  // Logging Request lifecycle
  app.addHook('onRequest', async (request) => {
    logger.info('Gateway request', {
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      ip: request.ip,
    });
  });

  // Swagger Documentation Setup
  app.register(fastifySwagger, {
    mode: 'static',
    specification: {
      document: openApiDocument as any,
    },
  });

  app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Open API json exposure
  app.get('/openapi.json', async (_request, reply) => {
    reply.send(openApiDocument);
  });

  // Health check routes
  app.register(healthRouter, { prefix: '/health' });

  // Gateway Service Proxy routing
  app.register(registerProxyRoutes);

  // Error and Not Found handlers
  app.setErrorHandler((error, request, reply) => {
    const isProduction = config.app.isProduction;
    const statusCode = error.statusCode || 500;

    logger.error('Gateway request failed', {
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      message: error.message,
      stack: error.stack,
    });

    reply.status(statusCode).send({
      success: false,
      error: {
        code: error.code || 'INTERNAL_SERVER_ERROR',
        message: isProduction && statusCode === 500 ? 'Internal server error' : error.message,
      },
      requestId: request.requestId,
    });
  });

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
