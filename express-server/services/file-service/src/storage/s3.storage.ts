import { PassThrough } from 'stream';
import { ReadStream } from 'fs';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';
import { logger } from '../lib/logger';
import { IS3Storage, StorageResult } from '../types/storage.types';

export class S3Storage implements IS3Storage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor() {
    this.region = config.aws.region;
    this.bucket = config.aws.s3Bucket;

    this.client = new S3Client({
      region: this.region,
      credentials:
        config.aws.accessKeyId !== '' && config.aws.secretAccessKey !== ''
          ? {
              accessKeyId: config.aws.accessKeyId,
              secretAccessKey: config.aws.secretAccessKey,
            }
          : undefined,
    });

    logger.info('S3 storage initialized', { bucket: this.bucket, region: this.region });
  }

  async save(buffer: Buffer, filename: string, mimeType: string): Promise<StorageResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: filename,
      Body: buffer,
      ContentType: mimeType,
      ContentLength: buffer.length,
    });

    try {
      await this.client.send(command);

      const headCommand = new HeadObjectCommand({ Bucket: this.bucket, Key: filename });
      const head = await this.client.send(headCommand);

      logger.debug('File uploaded to S3', { key: filename, size: head.ContentLength });

      return {
        filename,
        path: filename,
        url: this.getUrl(filename),
        size: head.ContentLength ?? buffer.length,
        mimeType,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to upload file to S3', { key: filename, error: err.message });
      throw new Error(`S3 upload failed: ${err.message}`);
    }
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });

    try {
      await this.client.send(command);
      logger.debug('File deleted from S3', { key });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to delete file from S3', { key, error: err.message });
      throw new Error(`S3 delete failed: ${err.message}`);
    }
  }

  getStream(key: string): ReadStream {
    const passThrough = new PassThrough();

    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });

    this.client
      .send(command)
      .then((response) => {
        if (response.Body == null) {
          passThrough.destroy(new Error(`S3 object body is empty for key: ${key}`));

          return;
        }

        // AWS SDK v3 Body is a Readable-like stream
        const body = response.Body as NodeJS.ReadableStream;
        body.pipe(passThrough);
      })
      .catch((error: unknown) => {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Failed to get S3 stream', { key, error: err.message });
        passThrough.destroy(err);
      });

    return passThrough as unknown as ReadStream;
  }

  getUrl(key: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });

    try {
      const url = await awsGetSignedUrl(this.client, command, { expiresIn });
      logger.debug('Generated S3 signed URL', { key, expiresIn });

      return url;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to generate S3 signed URL', { key, error: err.message });
      throw new Error(`Failed to generate signed URL: ${err.message}`);
    }
  }
}
