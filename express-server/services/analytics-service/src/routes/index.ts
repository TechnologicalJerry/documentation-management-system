import { Router } from 'express';
import { analyticsRouter } from './analytics.routes';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ service: 'analytics-service', status: 'healthy', timestamp: new Date().toISOString() });
});

apiRouter.use('/analytics', analyticsRouter);
