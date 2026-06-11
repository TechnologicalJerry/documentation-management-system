import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { StatusCodes } from 'http-status-codes';
import { config } from './config';
import { logger } from './lib/logger';
import { apiRouter } from './routes';
import { aiErrorHandler } from './controllers/ai.controller';

export function createApp(): Application {
  const app = express();

  // ---------------------------------------------------------------------------
  // Security middleware
  // ---------------------------------------------------------------------------
  app.use(helmet());
  app.disable('x-powered-by');

  // ---------------------------------------------------------------------------
  // CORS
  // ---------------------------------------------------------------------------
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || config.cors.origins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin ${origin} not allowed`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    }),
  );

  // ---------------------------------------------------------------------------
  // Rate limiting
  // ---------------------------------------------------------------------------
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(StatusCodes.TOO_MANY_REQUESTS).json({
        success: false,
        error: 'Too many requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED',
      });
    },
  });
  app.use(limiter);

  // ---------------------------------------------------------------------------
  // Body parsing
  // ---------------------------------------------------------------------------
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ---------------------------------------------------------------------------
  // Request logging
  // ---------------------------------------------------------------------------
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.debug(`${req.method} ${req.path}`, {
      query: req.query,
      ip: req.ip,
    });
    next();
  });

  // ---------------------------------------------------------------------------
  // Routes
  // ---------------------------------------------------------------------------
  app.use('/api/v1', apiRouter);
  app.get('/health', (_req: Request, res: Response) => {
    res.status(StatusCodes.OK).json({
      status: 'ok',
      service: 'ai-service',
      timestamp: new Date().toISOString(),
    });
  });

  // ---------------------------------------------------------------------------
  // 404
  // ---------------------------------------------------------------------------
  app.use((_req: Request, res: Response) => {
    res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      error: 'Route not found',
      code: 'NOT_FOUND',
    });
  });

  // ---------------------------------------------------------------------------
  // Global error handler
  // ---------------------------------------------------------------------------
  app.use(aiErrorHandler);

  return app;
}
