import fs from 'fs';
import path from 'path';
import { ReadStream } from 'fs';
import fse from 'fs-extra';
import { config } from '../config';
import { logger } from '../lib/logger';
import { IStorage, StorageResult } from '../types/storage.types';

export class LocalStorage implements IStorage {
  private readonly storagePath: string;
  private readonly baseUrl: string;

  constructor(storagePath?: string, baseUrl?: string) {
    this.storagePath = storagePath ?? config.storage.localPath;
    this.baseUrl = baseUrl ?? config.app.baseUrl;
    this.ensureStorageDirectory();
  }

  private ensureStorageDirectory(): void {
    try {
      fse.ensureDirSync(this.storagePath);
      logger.info('Local storage directory ensured', { path: this.storagePath });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to create storage directory', {
        path: this.storagePath,
        error: err.message,
      });
      throw err;
    }
  }

  async save(buffer: Buffer, filename: string, mimeType: string): Promise<StorageResult> {
    const filePath = path.join(this.storagePath, filename);

    try {
      await fse.outputFile(filePath, buffer);
      const stats = await fse.stat(filePath);

      logger.debug('File saved to local storage', { filename, path: filePath, size: stats.size });

      return {
        filename,
        path: filePath,
        url: this.getUrl(filename),
        size: stats.size,
        mimeType,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to save file to local storage', {
        filename,
        error: err.message,
      });
      throw new Error(`Failed to save file: ${err.message}`);
    }
  }

  async delete(filePath: string): Promise<void> {
    try {
      const exists = await fse.pathExists(filePath);
      if (!exists) {
        logger.warn('File not found for deletion', { path: filePath });

        return;
      }

      await fse.remove(filePath);
      logger.debug('File deleted from local storage', { path: filePath });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to delete file from local storage', {
        path: filePath,
        error: err.message,
      });
      throw new Error(`Failed to delete file: ${err.message}`);
    }
  }

  getStream(filePath: string): ReadStream {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    return fs.createReadStream(filePath);
  }

  getUrl(filename: string): string {
    return `${this.baseUrl}/files/${filename}/download`;
  }
}
