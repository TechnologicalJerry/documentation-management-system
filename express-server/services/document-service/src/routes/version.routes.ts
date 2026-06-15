import { Router } from 'express';
import { VersionController } from '../controllers/version.controller';
import { validate } from '../middleware/validate.middleware';
import {
  documentIdParamSchema,
  versionParamSchema,
  compareVersionsSchema,
} from '../validators/document.validators';

export function createVersionRouter(controller: VersionController): Router {
  const router = Router({ mergeParams: true });

  // Base path: /projects/:projectId/documents/:id/versions

  /**
   * GET /projects/:projectId/documents/:id/versions
   * List all versions of a document (newest first)
   */
  router.get(
    '/',
    validate(documentIdParamSchema),
    controller.getVersions,
  );

  /**
   * GET /projects/:projectId/documents/:id/versions/compare
   * Compare two versions: ?v1=1&v2=3
   */
  router.get(
    '/compare',
    validate(compareVersionsSchema),
    controller.compareVersions,
  );

  /**
   * GET /projects/:projectId/documents/:id/versions/:version
   * Get a specific version of a document
   */
  router.get(
    '/:version',
    validate(versionParamSchema),
    controller.getVersion,
  );

  /**
   * POST /projects/:projectId/documents/:id/versions/:version/restore
   * Restore document to a specific historical version
   */
  router.post(
    '/:version/restore',
    validate(versionParamSchema),
    controller.restoreVersion,
  );

  return router;
}
