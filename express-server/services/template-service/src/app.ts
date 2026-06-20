import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { StatusCodes } from 'http-status-codes';
import { config } from './config';
import { createApiRouter } from './routes';
import { TemplateRepository } from './repositories/template.repository';
import { TemplateService } from './services/template.service';
import { createTemplateController, templateErrorHandler } from './controllers/template.controller';
import { logger } from './lib/logger';

export function createApp(): express.Application {
  const app = express();

  // ─── Security & parsing middleware ──────────────────────────────────────────
  app.use(helmet());

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          // Allow server-to-server or non-browser requests
          callback(null, true);

          return;
        }
        if (config.cors.origins.includes(origin) || config.cors.origins.includes('*')) {
          callback(null, true);
        } else {
          callback(new Error(`CORS policy does not allow origin: ${origin}`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    }),
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ─── Rate limiting ───────────────────────────────────────────────────────────
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(StatusCodes.TOO_MANY_REQUESTS).json({
        success: false,
        error: 'Too many requests, please try again later.',
      });
    },
  });
  app.use(limiter);

  // ─── Request logging ─────────────────────────────────────────────────────────
  app.use((req, _res, next) => {
    logger.debug('Incoming request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    next();
  });

  // ─── Dependency wiring ────────────────────────────────────────────────────────
  const templateRepository = new TemplateRepository();
  const templateService = new TemplateService(templateRepository);
  const templateController = createTemplateController(templateService);

  // ─── Routes ──────────────────────────────────────────────────────────────────
  app.use('/api/v1', createApiRouter(templateController));
  app.get('/health', (_req, res) => {
    res.json({
      success: true,
      service: 'template-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  // ─── 404 handler ─────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      error: 'Route not found',
    });
  });

  // ─── Global error handler ────────────────────────────────────────────────────
  app.use(templateErrorHandler);

  return app;
}
