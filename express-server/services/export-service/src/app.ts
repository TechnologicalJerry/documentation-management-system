import compression from 'compression';
import cors from 'cors';
import express, { Application } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config } from './config';
import { apiRouter } from './routes';
import { exportErrorHandler } from './controllers/export.controller';

export function createApp(): Application {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(compression());
  app.use(cors({ origin: config.app.isProduction ? config.cors.origins : true, credentials: true }));
  app.use(
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use('/api/v1', apiRouter);
  app.get('/health', (_req, res) => {
    res.json({ service: 'export-service', status: 'healthy', timestamp: new Date().toISOString() });
  });
  app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  });
  app.use(exportErrorHandler);

  return app;
}
