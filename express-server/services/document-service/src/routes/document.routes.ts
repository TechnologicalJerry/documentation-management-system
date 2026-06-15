import { Router } from 'express';
import { DocumentController } from '../controllers/document.controller';
import { validate } from '../middleware/validate.middleware';
import {
  createDocumentSchema,
  updateDocumentSchema,
  documentIdParamSchema,
  documentQuerySchema,
  searchQuerySchema,
  projectIdParamSchema,
} from '../validators/document.validators';

export function createDocumentRouter(controller: DocumentController): Router {
  const router = Router({ mergeParams: true });

  // ── Project-scoped document collection ──────────────────────────────────────
  // Base path: /projects/:projectId/documents

  /**
   * GET /projects/:projectId/documents
   * List documents in a project with filtering and pagination
   */
  router.get(
    '/',
    validate(documentQuerySchema),
    controller.getDocuments,
  );

  /**
   * POST /projects/:projectId/documents
   * Create a new document in a project
   */
  router.post(
    '/',
    validate(createDocumentSchema),
    controller.createDocument,
  );

  /**
   * GET /projects/:projectId/documents/tree
   * Get hierarchical document tree for a project
   */
  router.get(
    '/tree',
    validate(projectIdParamSchema),
    controller.getDocumentTree,
  );

  /**
   * GET /projects/:projectId/documents/search
   * Full-text search within a project's documents
   */
  router.get(
    '/search',
    validate(searchQuerySchema),
    controller.searchDocuments,
  );

  // ── Single document resource ─────────────────────────────────────────────────
  // Base path: /projects/:projectId/documents/:id

  /**
   * GET /projects/:projectId/documents/:id
   * Get a single document by ID
   */
  router.get(
    '/:id',
    validate(documentIdParamSchema),
    controller.getDocument,
  );

  /**
   * PATCH /projects/:projectId/documents/:id
   * Partially update a document (creates a new version snapshot)
   */
  router.patch(
    '/:id',
    validate(updateDocumentSchema),
    controller.updateDocument,
  );

  /**
   * DELETE /projects/:projectId/documents/:id
   * Soft-delete a document
   */
  router.delete(
    '/:id',
    validate(documentIdParamSchema),
    controller.deleteDocument,
  );

  // ── Status workflow actions ───────────────────────────────────────────────────

  /**
   * POST /projects/:projectId/documents/:id/review
   * Submit document for review (DRAFT -> REVIEW)
   */
  router.post(
    '/:id/review',
    validate(documentIdParamSchema),
    controller.submitForReview,
  );

  /**
   * POST /projects/:projectId/documents/:id/publish
   * Publish a document (REVIEW -> PUBLISHED)
   */
  router.post(
    '/:id/publish',
    validate(documentIdParamSchema),
    controller.publishDocument,
  );

  /**
   * POST /projects/:projectId/documents/:id/archive
   * Archive a document
   */
  router.post(
    '/:id/archive',
    validate(documentIdParamSchema),
    controller.archiveDocument,
  );

  // ── Collaboration locking ─────────────────────────────────────────────────────

  /**
   * POST /projects/:projectId/documents/:id/lock
   * Acquire an exclusive edit lock on a document
   */
  router.post(
    '/:id/lock',
    validate(documentIdParamSchema),
    controller.lockDocument,
  );

  /**
   * DELETE /projects/:projectId/documents/:id/lock
   * Release the edit lock on a document
   */
  router.delete(
    '/:id/lock',
    validate(documentIdParamSchema),
    controller.unlockDocument,
  );

  return router;
}
