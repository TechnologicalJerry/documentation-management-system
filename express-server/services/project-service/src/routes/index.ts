import { Router, Request, Response } from 'express';
import { projectRouter } from './project.routes';
import { projectMemberRouter } from './projectMember.routes';

const router = Router();

// Health check
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'project-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Project CRUD
router.use('/projects', projectRouter);

// Member management — nested under projects
router.use('/projects/:projectId/members', projectMemberRouter);

export { router as apiRouter };
