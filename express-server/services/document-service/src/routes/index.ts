import { Router } from 'express';
import { DocumentController } from '../controllers/document.controller';
import { VersionController } from '../controllers/version.controller';
import { CommentController } from '../controllers/comment.controller';
import { createDocumentRouter } from './document.routes';
import { createVersionRouter } from './version.routes';
import { createCommentRouter } from './comment.routes';
import { DocumentService } from '../services/document.service';
import { VersionService } from '../services/version.service';
import { CommentService } from '../services/comment.service';
import { DocumentRepository } from '../repositories/document.repository';
import { DocumentVersionRepository } from '../repositories/documentVersion.repository';
import { CommentRepository } from '../repositories/comment.repository';
import { DocumentPublisher } from '../events/document.publisher';

export function createRootRouter(publisher: DocumentPublisher): Router {
  // ── Instantiate infrastructure ───────────────────────────────────────────────
  const documentRepo = new DocumentRepository();
  const versionRepo = new DocumentVersionRepository();
  const commentRepo = new CommentRepository();

  // ── Instantiate services ─────────────────────────────────────────────────────
  const documentService = new DocumentService(documentRepo, versionRepo, publisher);
  const versionService = new VersionService(documentRepo, versionRepo);
  const commentService = new CommentService(documentRepo, commentRepo);

  // ── Instantiate controllers ──────────────────────────────────────────────────
  const documentController = new DocumentController(documentService);
  const versionController = new VersionController(versionService);
  const commentController = new CommentController(commentService);

  // ── Mount routers ────────────────────────────────────────────────────────────
  const router = Router();

  /**
   * Health endpoint — used by load balancers and Kubernetes probes
   */
  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'document-service',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * All document routes are scoped under a projectId so that the service can
   * efficiently filter by project and maintain slug uniqueness per project.
   *
   * Pattern: /projects/:projectId/documents[/...]
   */
  const documentRouter = createDocumentRouter(documentController);
  const versionRouter = createVersionRouter(versionController);
  const commentRouter = createCommentRouter(commentController);

  // Mount version and comment routers as children of the document router
  router.use(
    '/projects/:projectId/documents/:id/versions',
    versionRouter,
  );

  router.use(
    '/projects/:projectId/documents/:id/comments',
    commentRouter,
  );

  router.use('/projects/:projectId/documents', documentRouter);

  return router;
}
