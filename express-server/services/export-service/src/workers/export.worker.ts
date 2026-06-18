import amqplib, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { ExportService } from '../services/export.service';
import { config } from '../config';
import { logger } from '../lib/logger';

// ── Job payload on the queue ───────────────────────────────

interface ExportJobMessage {
  jobId: string;
  token: string;
  retryCount?: number;
}

const MAX_RETRIES = 3;
const QUEUE_NAME = 'export-jobs';
const DLQ_NAME = 'export-jobs-dlq';

export class ExportWorker {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private readonly exportService: ExportService;
  /** In-memory queue for environments without RabbitMQ (e.g. tests) */
  private inMemoryQueue: Array<{ jobId: string; token: string }> = [];
  private processing = false;

  constructor(exportService: ExportService) {
    this.exportService = exportService;
  }

  // ── Public API ─────────────────────────────────────────

  /**
   * Enqueue a job. Uses RabbitMQ when available, falls back to in-memory.
   */
  async enqueue(jobId: string, token: string): Promise<void> {
    if (this.channel) {
      await this.publishToRabbitMQ(jobId, token);
    } else {
      this.inMemoryQueue.push({ jobId, token });
      // Fire-and-forget processing loop
      void this.processInMemoryQueue();
    }
  }

  /**
   * Start the worker and listen for messages from RabbitMQ.
   */
  async start(): Promise<void> {
    try {
      await this.connectRabbitMQ();
      await this.consume();
      logger.info('Export worker started (RabbitMQ mode)');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn('RabbitMQ unavailable, worker running in in-memory mode', {
        error: err.message,
      });
    }
  }

  /**
   * Gracefully stop the worker.
   */
  async stop(): Promise<void> {
    try {
      if (this.channel) {await this.channel.close();}
      if (this.connection) {await this.connection.close();}
      logger.info('Export worker stopped');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error stopping export worker', { error: err.message });
    }
  }

  // ── RabbitMQ ───────────────────────────────────────────

  private async connectRabbitMQ(): Promise<void> {
    this.connection = await amqplib.connect(config.rabbitmq.url);
    this.channel = await this.connection.createChannel();

    // Main queue with DLQ setup
    await this.channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': DLQ_NAME,
      },
    });

    // Dead-letter queue
    await this.channel.assertQueue(DLQ_NAME, { durable: true });

    // Limit concurrency to 2 concurrent jobs per worker
    this.channel.prefetch(2);

    this.connection.on('error', (err) => {
      logger.error('RabbitMQ connection error', { error: err.message });
      this.connection = null;
      this.channel = null;
    });

    this.connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
      this.connection = null;
      this.channel = null;
    });
  }

  private async publishToRabbitMQ(jobId: string, token: string): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }

    const message: ExportJobMessage = { jobId, token, retryCount: 0 };
    this.channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
      persistent: true,
      contentType: 'application/json',
      timestamp: Date.now(),
    });

    logger.debug('Export job enqueued to RabbitMQ', { jobId });
  }

  private async consume(): Promise<void> {
    if (!this.channel) {return;}

    await this.channel.consume(
      QUEUE_NAME,
      async (msg: ConsumeMessage | null) => {
        if (!msg) {return;}

        let message: ExportJobMessage | null = null;
        try {
          message = JSON.parse(msg.content.toString()) as ExportJobMessage;
          logger.debug('Processing export job from queue', { jobId: message.jobId });

          await this.exportService.processExport(message.jobId, message.token);
          this.channel?.ack(msg);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          const retryCount = (message?.retryCount ?? 0) + 1;

          logger.error('Export job processing failed', {
            jobId: message?.jobId,
            error: err.message,
            retryCount,
          });

          if (retryCount <= MAX_RETRIES && message) {
            // Requeue with incremented retry count after a delay
            setTimeout(() => {
              const retryMessage: ExportJobMessage = {
                ...message!,
                retryCount,
              };
              this.channel?.sendToQueue(
                QUEUE_NAME,
                Buffer.from(JSON.stringify(retryMessage)),
                { persistent: true },
              );
            }, retryCount * 2000);

            this.channel?.ack(msg);
          } else {
            // Send to DLQ
            logger.error('Moving job to DLQ after max retries', { jobId: message?.jobId });
            this.channel?.nack(msg, false, false);
          }
        }
      },
      { noAck: false },
    );
  }

  // ── In-memory fallback ─────────────────────────────────

  private async processInMemoryQueue(): Promise<void> {
    if (this.processing) {return;}
    this.processing = true;

    while (this.inMemoryQueue.length > 0) {
      const item = this.inMemoryQueue.shift();
      if (!item) {break;}

      try {
        logger.debug('Processing export job (in-memory mode)', { jobId: item.jobId });
        await this.exportService.processExport(item.jobId, item.token);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('In-memory export job failed', { jobId: item.jobId, error: err.message });
        // Update job status to FAILED is already handled inside processExport
      }
    }

    this.processing = false;
  }
}
