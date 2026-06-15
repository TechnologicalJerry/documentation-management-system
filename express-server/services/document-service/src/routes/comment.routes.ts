import { Router } from 'express';
import { CommentController } from '../controllers/comment.controller';
import { validate } from '../middleware/validate.middleware';
import {
  createCommentSchema,
  updateCommentSchema,
  commentIdParamSchema,
  documentIdParamSchema,
} from '../validators/document.validators';

export function createCommentRouter(controller: CommentController): Router {
  const router = Router({ mergeParams: true });

  // Base path: /projects/:projectId/documents/:id/comments

  /**
   * GET /projects/:projectId/documents/:id/comments
   * List all comments on a document (threaded)
   */
  router.get(
    '/',
    validate(documentIdParamSchema),
    controller.getComments,
  );

  /**
   * POST /projects/:projectId/documents/:id/comments
   * Add a comment (or reply) to a document
   */
  router.post(
    '/',
    validate(createCommentSchema),
    controller.addComment,
  );

  /**
   * PATCH /projects/:projectId/documents/:id/comments/:commentId
   * Edit your own comment
   */
  router.patch(
    '/:commentId',
    validate(updateCommentSchema),
    controller.updateComment,
  );

  /**
   * DELETE /projects/:projectId/documents/:id/comments/:commentId
   * Soft-delete your own comment
   */
  router.delete(
    '/:commentId',
    validate(commentIdParamSchema),
    controller.deleteComment,
  );

  /**
   * POST /projects/:projectId/documents/:id/comments/:commentId/resolve
   * Mark a comment thread as resolved
   */
  router.post(
    '/:commentId/resolve',
    validate(commentIdParamSchema),
    controller.resolveComment,
  );

  /**
   * DELETE /projects/:projectId/documents/:id/comments/:commentId/resolve
   * Unresolve (re-open) a comment thread
   */
  router.delete(
    '/:commentId/resolve',
    validate(commentIdParamSchema),
    controller.unresolveComment,
  );

  return router;
}
