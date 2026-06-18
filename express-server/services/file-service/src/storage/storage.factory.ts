import { config, StorageProvider } from '../config';
import { logger } from '../lib/logger';
import { IStorage, IS3Storage } from '../types/storage.types';
import { LocalStorage } from './local.storage';
import { S3Storage } from './s3.storage';

export class StorageFactory {
  private static instance: IStorage | null = null;

  static create(provider?: StorageProvider): IStorage {
    const resolvedProvider = provider ?? config.storage.provider;

    switch (resolvedProvider) {
      case 's3': {
        logger.info('Using S3 storage provider');

        return new S3Storage();
      }

      case 'local':
      default: {
        logger.info('Using local storage provider', { path: config.storage.localPath });

        return new LocalStorage();
      }
    }
  }

  static getInstance(): IStorage {
    if (StorageFactory.instance === null) {
      StorageFactory.instance = StorageFactory.create();
    }

    return StorageFactory.instance;
  }

  static resetInstance(): void {
    StorageFactory.instance = null;
  }
}

export function isS3Storage(storage: IStorage): storage is IS3Storage {
  return 'getSignedUrl' in storage;
}
