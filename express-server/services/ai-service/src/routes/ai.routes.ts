import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import {
  GenerateRequestSchema,
  GenerateQuerySchema,
  validateBody,
  validateQuery,
} from '../validators/ai.validators';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const controller = new AIController();

/**
 * POST /generate
 * Start an AI generation job.
 */
router.post(
  '/generate',
  authMiddleware,
  validateBody(GenerateRequestSchema),
  controller.startGeneration,
);

/**
 * GET /generate
 * List all generations for the authenticated user.
 */
router.get(
  '/generate',
  authMiddleware,
  validateQuery(GenerateQuerySchema),
  controller.listGenerations,
);

/**
 * GET /generate/:id
 * Get the status and result of a specific generation.
 */
router.get(
  '/generate/:id',
  authMiddleware,
  controller.getGeneration,
);

/**
 * DELETE /generate/:id
 * Cancel a pending or running generation.
 */
router.delete(
  '/generate/:id',
  authMiddleware,
  controller.cancelGeneration,
);

/**
 * GET /generate/:id/stream
 * Stream the generation result as SSE (text/event-stream).
 */
router.get(
  '/generate/:id/stream',
  authMiddleware,
  controller.streamGeneration,
);

/**
 * GET /models
 * List available models from the configured provider.
 */
router.get('/models', authMiddleware, controller.getModels);

/**
 * GET /health/providers
 * Check availability of AI providers. No auth required (used by health checks).
 */
router.get('/health/providers', controller.checkProviders);

export { router as aiRouter };
