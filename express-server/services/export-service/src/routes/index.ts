import { Router } from 'express';
import { exportRouter } from './export.routes';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ service: 'export-service', status: 'healthy', timestamp: new Date().toISOString() });
});

apiRouter.use('/exports', exportRouter);
apiRouter.use('/export', exportRouter);
