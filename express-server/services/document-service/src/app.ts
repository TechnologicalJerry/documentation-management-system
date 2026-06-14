import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { StatusCodes } from 'http-status-codes';
import { config } from './config';
import { createRootRouter } from './routes';
import { DocumentPublisher } from './events/document.publisher';
import { logger } from './lib/logger';

export function createApp(publisher: DocumentPublisher): Application {
  const app = express();

  // ── Security middleware ────────────────────────────────────────────────────
  app.use(helmet());

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. curl, mobile clients)
        if (origin === undefined || config.cors.origins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS policy: origin ${origin} not allowed`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-request-id'],
    }),
  );

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' },
    },
  });

  app.use(limiter);

  // ── Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ── Request logging ───────────────────────────────────────────────────────
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.debug(`${req.method} ${req.path}`, {
      query: req.query,
      userId: req.headers['x-user-id'],
      requestId: req.headers['x-request-id'],
    });
    next();
  });

  // ── Routes ────────────────────────────────────────────────────────────────
  const rootRouter = createRootRouter(publisher);
  app.use('/api/v1', rootRouter);

  // Root health check (for very simple probe setups)
  app.get('/', (_req: Request, res: Response) => {
    res.json({ service: 'document-service', status: 'running' });
  });
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      service: 'document-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  // ── 404 handler ───────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'The requested resource does not exist' },
    });
  });

  // ── Global error handler ──────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled application error', {
      message: err.message,
      stack: err.stack,
    });

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: config.app.isProduction ? 'An unexpected error occurred' : err.message,
      },
    });
  });

  return app;
}
