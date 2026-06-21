import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { logger } from './utils/logger';

export function createApp(): Application {
  const app = express();

  // ─── Security Headers ─────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: false, // Managed at gateway level
    }),
  );

  // ─── CORS ─────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin:
        process.env['NODE_ENV'] === 'production'
          ? (process.env['ALLOWED_ORIGINS'] ?? '').split(',').filter(Boolean)
          : true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Service-Name'],
    }),
  );

  // ─── Body Parsing ─────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ─── Rate Limiting ────────────────────────────────────────────────────────
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env['NODE_ENV'] === 'test' ? 10000 : 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  });
  app.use(limiter);

  // ─── Request Logging ──────────────────────────────────────────────────────
  app.use((req, _res, next) => {
    logger.debug('Incoming request', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    next();
  });

  // ─── Routes ───────────────────────────────────────────────────────────────
  app.use('/api/v1', apiRouter);
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'user-service',
      timestamp: new Date().toISOString(),
    });
  });

  // ─── 404 Handler ──────────────────────────────────────────────────────────
  app.use(notFoundHandler);

  // ─── Error Handler ────────────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
