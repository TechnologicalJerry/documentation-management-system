import { Router, Request, Response } from 'express';
import { notificationRouter } from './notification.routes';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'notification-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

router.use('/notifications', notificationRouter);

export { router as apiRouter };
