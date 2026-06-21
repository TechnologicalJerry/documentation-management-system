import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import { config } from '../config';

// ─── Storage (memory for passing to external file service) ───────────────────

const storage = multer.memoryStorage();

// ─── File Filter ──────────────────────────────────────────────────────────────

const avatarFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  if (config.avatar.allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type '${file.mimetype}'. Allowed: ${config.avatar.allowedMimeTypes.join(', ')}`,
      ),
    );
  }
};

// ─── Multer Instance ──────────────────────────────────────────────────────────

export const avatarUpload = multer({
  storage,
  fileFilter: avatarFileFilter,
  limits: {
    fileSize: config.avatar.maxSizeMb * 1024 * 1024,
    files: 1,
  },
});

// ─── Middleware ───────────────────────────────────────────────────────────────

export const uploadAvatarMiddleware = avatarUpload.single('avatar');
