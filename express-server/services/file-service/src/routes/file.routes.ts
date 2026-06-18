import { Router } from 'express';
import { FileController } from '../controllers/file.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { uploadSingle, uploadMultiple } from '../middleware/upload.middleware';

export function createFileRouter(controller?: FileController): Router {
  const router = Router();
  const fileController = controller ?? new FileController();

  /**
   * POST /files/upload
   * Upload a single file. Requires authentication.
   */
  router.post(
    '/upload',
    authenticate,
    uploadSingle,
    fileController.uploadFile,
  );

  /**
   * POST /files/upload/multiple
   * Upload multiple files (up to 10). Requires authentication.
   */
  router.post(
    '/upload/multiple',
    authenticate,
    uploadMultiple,
    fileController.uploadMultipleFiles,
  );

  /**
   * GET /files
   * List files with optional filters. Requires authentication.
   */
  router.get('/', authenticate, fileController.listFiles);

  /**
   * GET /files/:id
   * Get file metadata. Public files accessible without auth.
   */
  router.get('/:id', optionalAuthenticate, fileController.getFile);

  /**
   * GET /files/:id/download
   * Download file as attachment. Public files accessible without auth.
   */
  router.get('/:id/download', optionalAuthenticate, fileController.downloadFile);

  /**
   * GET /files/:id/stream
   * Stream file inline. Public files accessible without auth.
   */
  router.get('/:id/stream', optionalAuthenticate, fileController.streamFile);

  /**
   * POST /files/:id/thumbnail
   * Generate a thumbnail for an image file. Requires authentication.
   */
  router.post('/:id/thumbnail', authenticate, fileController.generateThumbnail);

  /**
   * PATCH /files/:id
   * Update file metadata. Requires authentication.
   */
  router.patch('/:id', authenticate, fileController.updateFileMetadata);

  /**
   * DELETE /files/:id
   * Soft-delete a file. Requires authentication.
   */
  router.delete('/:id', authenticate, fileController.deleteFile);

  return router;
}
