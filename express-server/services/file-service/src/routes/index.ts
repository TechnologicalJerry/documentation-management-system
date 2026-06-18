import { Router, Request, Response } from 'express';
import { createFileRouter } from './file.routes';

export function createRouter(): Router {
  const router = Router();

  router.get('/health', (_req: Request, res: Response): void => {
    res.status(200).json({
      status: 'ok',
      service: 'file-service',
      timestamp: new Date().toISOString(),
    });
  });

  router.use('/files', createFileRouter());

  return router;
}
