import { Router } from 'express';
import { createTemplateRouter } from './template.routes';
import type { TemplateController } from '../controllers/template.controller';

export function createApiRouter(templateController: TemplateController): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({
      success: true,
      service: 'template-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  router.use('/templates', createTemplateRouter(templateController));

  return router;
}
