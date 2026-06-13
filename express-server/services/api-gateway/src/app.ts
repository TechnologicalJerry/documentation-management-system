import compression from 'compression';
import cors from 'cors';
import express, { Application } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { openApiDocument } from './docs/openapi';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { requestContext } from './middleware/requestContext.middleware';
import { healthRouter } from './routes/health.routes';
import { registerProxyRoutes } from './routes/proxy.routes';
import { logger } from './lib/logger';

export function createApp(): Application {
  const app = express();

  app.set('trust proxy', 1);
  app.use(requestContext);
  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || !config.app.isProduction || config.cors.origins.includes(origin)) {
          callback(null, true);

          return;
        }
        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true,
    }),
  );
  app.use(
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use((req, _res, next) => {
    logger.info('Gateway request', {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
    });
    next();
  });

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.get('/openapi.json', (_req, res) => res.json(openApiDocument));
  app.use('/health', healthRouter);
  registerProxyRoutes(app);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
