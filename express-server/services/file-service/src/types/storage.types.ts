import { ReadStream } from 'fs';

export interface StorageResult {
  filename: string;
  path: string;
  url: string;
  size: number;
  mimeType: string;
}

export interface IStorage {
  save(buffer: Buffer, filename: string, mimeType: string): Promise<StorageResult>;
  delete(pathOrKey: string): Promise<void>;
  getStream(pathOrKey: string): ReadStream;
  getUrl(filenameOrKey: string): string;
}

export interface IS3Storage extends IStorage {
  getSignedUrl(key: string, expiresIn: number): Promise<string>;
}
