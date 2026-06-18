import { Request } from 'express';
import { JwtPayload } from '@devdocs/shared-types';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export interface UploadFileOptions {
  projectId?: string;
  documentId?: string;
  isPublic?: boolean;
  tags?: string[];
}

export interface FileQuery {
  page?: number;
  limit?: number;
  projectId?: string;
  documentId?: string;
  uploaderId?: string;
  mimeType?: string;
  isPublic?: boolean;
  tags?: string[];
  search?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UpdateFileMetadataPayload {
  originalName?: string;
  isPublic?: boolean;
  tags?: string[];
  projectId?: string;
  documentId?: string;
}

export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}
