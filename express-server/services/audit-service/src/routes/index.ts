import { Router } from 'express';
import { auditRouter } from './audit.routes';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ service: 'audit-service', status: 'healthy', timestamp: new Date().toISOString() });
});

apiRouter.use('/audit', auditRouter);
