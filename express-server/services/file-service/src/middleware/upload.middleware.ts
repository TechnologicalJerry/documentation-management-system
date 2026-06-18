import multer, { FileFilterCallback, StorageEngine } from 'multer';
import { Request, RequestHandler } from 'express';
import { config } from '../config';
import { logger } from '../lib/logger';

const MAX_FILE_SIZE_BYTES = config.upload.maxFileSizeMb * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set(config.upload.allowedFileTypes);

const memoryStorage: StorageEngine = multer.memoryStorage();

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    logger.warn('Rejected file upload: unsupported MIME type', {
      mimetype: file.mimetype,
      originalname: file.originalname,
    });
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
}

const multerInstance = multer({
  storage: memoryStorage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 10,
  },
  fileFilter,
});

export const uploadSingle: RequestHandler = multerInstance.single('file');

export const uploadMultiple: RequestHandler = multerInstance.array('files', 10);

export const uploadFields = (fields: multer.Field[]): RequestHandler =>
  multerInstance.fields(fields);
