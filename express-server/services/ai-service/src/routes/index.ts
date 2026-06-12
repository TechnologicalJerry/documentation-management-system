import { Router, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { aiRouter } from './ai.routes';
import { generationQueue } from '../services/queue.service';

const router = Router();

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
router.get('/health', (_req: Request, res: Response) => {
  const queueStats = generationQueue.getStats();

  res.status(StatusCodes.OK).json({
    status: 'ok',
    service: 'ai-service',
    timestamp: new Date().toISOString(),
    queue: queueStats,
  });
});

// ---------------------------------------------------------------------------
// Mount feature routers
// ---------------------------------------------------------------------------
router.use('/', aiRouter);

export { router as apiRouter };
