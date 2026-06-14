import { Router } from 'express';
import { authRouter } from './auth.routes';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ service: 'auth-service', status: 'healthy', timestamp: new Date().toISOString() });
});

apiRouter.use('/auth', authRouter);
