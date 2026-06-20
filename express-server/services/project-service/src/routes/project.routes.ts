import { Router } from 'express';
import { MemberRole } from '@prisma/client';
import { ProjectController } from '../controllers/project.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import {
  requireProjectRole,
} from '../middleware/projectAccess.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createProjectSchema,
  projectQuerySchema,
  updateProjectSchema,
} from '../validators/project.validators';

const router = Router();
const controller = new ProjectController();

/**
 * @route   POST /api/projects
 * @desc    Create a new project
 * @access  Authenticated
 */
router.post(
  '/',
  authenticate,
  validate(createProjectSchema, 'body'),
  controller.createProject,
);

/**
 * @route   GET /api/projects
 * @desc    List projects accessible to the authenticated user
 * @access  Authenticated
 */
router.get(
  '/',
  authenticate,
  validate(projectQuerySchema, 'query'),
  controller.getProjects,
);

/**
 * @route   GET /api/projects/slug/:slug
 * @desc    Get a project by its URL slug
 * @access  Public (visibility-aware)
 */
router.get(
  '/slug/:slug',
  optionalAuthenticate,
  controller.getProjectBySlug,
);

/**
 * @route   GET /api/projects/:projectId
 * @desc    Get a project by ID
 * @access  Public (visibility-aware)
 */
router.get(
  '/:projectId',
  optionalAuthenticate,
  controller.getProject,
);

/**
 * @route   PATCH /api/projects/:projectId
 * @desc    Update a project (name, description, settings, tags, etc.)
 * @access  Admin or Owner
 */
router.patch(
  '/:projectId',
  authenticate,
  requireProjectRole(MemberRole.ADMIN),
  validate(updateProjectSchema, 'body'),
  controller.updateProject,
);

/**
 * @route   DELETE /api/projects/:projectId
 * @desc    Soft-delete a project (owner only)
 * @access  Owner
 */
router.delete(
  '/:projectId',
  authenticate,
  controller.deleteProject,
);

/**
 * @route   POST /api/projects/:projectId/archive
 * @desc    Archive a project
 * @access  Admin or Owner
 */
router.post(
  '/:projectId/archive',
  authenticate,
  requireProjectRole(MemberRole.ADMIN),
  controller.archiveProject,
);

/**
 * @route   POST /api/projects/:projectId/restore
 * @desc    Restore an archived project
 * @access  Admin or Owner
 */
router.post(
  '/:projectId/restore',
  authenticate,
  requireProjectRole(MemberRole.ADMIN),
  controller.restoreProject,
);

/**
 * @route   GET /api/projects/:projectId/stats
 * @desc    Get project statistics
 * @access  Member (Viewer+)
 */
router.get(
  '/:projectId/stats',
  authenticate,
  requireProjectRole(MemberRole.VIEWER),
  controller.getProjectStats,
);

export { router as projectRouter };
