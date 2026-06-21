import { Router } from 'express';
import { userRouter } from './user.routes';
import { organizationRouter } from './organization.routes';
import { teamRouter } from './team.routes';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'user-service',
    timestamp: new Date().toISOString(),
  });
});

// Resource routes
router.use('/users', userRouter);
router.use('/organizations', organizationRouter);
router.use('/teams', teamRouter);

export { router as apiRouter };
