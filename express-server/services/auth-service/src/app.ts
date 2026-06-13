import compression from 'compression';
import cors from 'cors';
import express, { Application } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config } from './config';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { logger } from './lib/logger';

export function createApp(): Application {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin: config.app.isProduction ? config.cors.origins : true,
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
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use((req, _res, next) => {
    logger.debug('Auth request', { method: req.method, url: req.originalUrl });
    next();
  });

  app.use('/api/v1', apiRouter);
  app.get('/health', (_req, res) => {
    res.json({ service: 'auth-service', status: 'healthy', timestamp: new Date().toISOString() });
  });
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
