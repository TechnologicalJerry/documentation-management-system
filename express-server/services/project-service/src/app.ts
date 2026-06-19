import compression from 'compression';
import cors from 'cors';
import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { StatusCodes } from 'http-status-codes';
import { config } from './config';
import { logger } from './lib/logger';
import { apiRouter } from './routes';
import { errorHandler } from './middleware/errorHandler.middleware';

export function createApp(): Application {
  const app = express();

  // ─── Security Middleware ─────────────────────────────────────────────────────
  app.use(helmet());

  app.use(
    cors({
      origin: (origin, callback) => {
        if (origin === undefined || config.cors.origins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: Origin ${origin} not allowed`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    }),
  );

  // ─── Rate Limiting ───────────────────────────────────────────────────────────
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  });
  app.use(limiter);

  // ─── Body Parsing ────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ─── Compression ─────────────────────────────────────────────────────────────
  app.use(compression());

  // ─── Logging ─────────────────────────────────────────────────────────────────
  if (!config.app.isTest) {
    app.use(
      morgan('combined', {
        stream: { write: (message: string) => logger.http(message.trim()) },
      }),
    );
  }

  // ─── Request ID ──────────────────────────────────────────────────────────────
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.headers['x-request-id'] ??= crypto.randomUUID();
    next();
  });

  // ─── API Routes ───────────────────────────────────────────────────────────────
  app.use('/api', apiRouter);
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'project-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // ─── 404 Handler ─────────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Route not found',
      code: 'NOT_FOUND',
    });
  });

  // ─── Global Error Handler ────────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
