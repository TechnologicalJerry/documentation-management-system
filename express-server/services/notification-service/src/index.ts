import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './lib/logger';
import { connectDatabase, disconnectDatabase } from './lib/knex';
import { apiRouter } from './routes';
import { notificationConsumer } from './events/notification.consumer';

const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  }),
);

// Rate limiting
app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
  }),
);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request ID middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.headers['x-request-id'] =
    (req.headers['x-request-id'] as string) ?? `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  next();
});

// API routes
app.use('/api/v1', apiRouter);
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'notification-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Resource not found' });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: config.app.isDevelopment ? err.stack : undefined,
  });

  res.status(500).json({
    success: false,
    message: config.app.isProduction ? 'Internal server error' : err.message,
  });
});

async function bootstrap(): Promise<void> {
  try {
    // Connect to MySQL
    await connectDatabase();

    // Connect to RabbitMQ and start consuming events
    await notificationConsumer.connect();
    await notificationConsumer.startConsuming();

    const server = app.listen(config.app.port, () => {
      logger.info(`${config.app.serviceName} listening on port ${config.app.port}`, {
        env: config.app.nodeEnv,
        port: config.app.port,
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received — shutting down gracefully`);

      server.close(async () => {
        logger.info('HTTP server closed');

        await notificationConsumer.disconnect();
        await disconnectDatabase();

        logger.info('Shutdown complete');
        process.exit(0);
      });

      // Force exit after 30s
      setTimeout(() => {
        logger.error('Forceful shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to start service', { error: err.message });
    process.exit(1);
  }
}

void bootstrap();

export { app };
