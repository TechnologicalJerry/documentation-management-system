import amqplib, { Channel, ChannelModel } from 'amqplib';
import { config } from '../config';
import { logger } from '../lib/logger';
import { IExportJob, ExportStatus } from '../models/exportJob.model';

// ── Event schemas ──────────────────────────────────────────

export interface ExportCompletedEvent {
  eventType: 'ExportCompleted';
  exportJobId: string;
  userId: string;
  documentIds: string[];
  projectId?: string;
  format: string;
  downloadUrl: string;
  outputSize: number;
  processingTime: number;
  expiresAt: string;
  completedAt: string;
  timestamp: string;
}

export interface ExportFailedEvent {
  eventType: 'ExportFailed';
  exportJobId: string;
  userId: string;
  documentIds: string[];
  format: string;
  error: string;
  timestamp: string;
}

// ── Publisher ──────────────────────────────────────────────

export class ExportPublisher {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private readonly exchange: string;

  constructor() {
    this.exchange = config.rabbitmq.exchange;
  }

  async connect(): Promise<void> {
    try {
      this.connection = await amqplib.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange(this.exchange, 'topic', { durable: true });

      this.connection.on('error', (err) => {
        logger.error('ExportPublisher: RabbitMQ connection error', { error: err.message });
        this.connection = null;
        this.channel = null;
      });

      this.connection.on('close', () => {
        logger.warn('ExportPublisher: RabbitMQ connection closed');
        this.connection = null;
        this.channel = null;
      });

      logger.info('ExportPublisher connected to RabbitMQ');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn('ExportPublisher: RabbitMQ not available, events will be skipped', {
        error: err.message,
      });
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.channel) {await this.channel.close();}
      if (this.connection) {await this.connection.close();}
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('ExportPublisher disconnect error', { error: err.message });
    }
  }

  // ── Publish helpers ────────────────────────────────────

  async publishExportCompleted(job: IExportJob): Promise<void> {
    if (job.status !== ExportStatus.COMPLETED) {return;}

    const event: ExportCompletedEvent = {
      eventType: 'ExportCompleted',
      exportJobId: job.id,
      userId: job.userId,
      documentIds: job.documentIds,
      projectId: job.projectId,
      format: job.format,
      downloadUrl: job.downloadUrl ?? '',
      outputSize: job.outputSize ?? 0,
      processingTime: job.processingTime ?? 0,
      expiresAt: job.expiresAt?.toISOString() ?? '',
      completedAt: job.completedAt?.toISOString() ?? new Date().toISOString(),
      timestamp: new Date().toISOString(),
    };

    await this.publish('export.completed', event);
  }

  async publishExportFailed(job: IExportJob): Promise<void> {
    const event: ExportFailedEvent = {
      eventType: 'ExportFailed',
      exportJobId: job.id,
      userId: job.userId,
      documentIds: job.documentIds,
      format: job.format,
      error: job.error ?? 'Unknown error',
      timestamp: new Date().toISOString(),
    };

    await this.publish('export.failed', event);
  }

  // ── Internal ───────────────────────────────────────────

  private async publish(routingKey: string, payload: unknown): Promise<void> {
    if (!this.channel) {
      logger.debug('ExportPublisher: skipping event publish (no channel)', { routingKey });

      return;
    }

    try {
      const message = Buffer.from(JSON.stringify(payload));
      this.channel.publish(this.exchange, routingKey, message, {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now(),
      });

      logger.debug('Event published', { routingKey, exchange: this.exchange });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to publish event', { routingKey, error: err.message });
    }
  }
}

// Singleton instance
export const exportPublisher = new ExportPublisher();
