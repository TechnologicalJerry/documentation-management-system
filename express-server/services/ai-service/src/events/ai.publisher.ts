import amqplib, { Channel, ChannelModel } from 'amqplib';
import { config } from '../config';
import { logger } from '../lib/logger';
import { GenerationType } from '../models/generation.model';

export interface AIGenerationCompletedPayload {
  generationId: string;
  userId: string;
  type: GenerationType;
  projectId?: string;
  documentId?: string;
  outputContent: string;
}

export interface AIGenerationFailedPayload {
  generationId: string;
  userId: string;
  type: GenerationType;
  projectId?: string;
  documentId?: string;
  error: string;
}

interface AMQPMessage {
  eventType: string;
  timestamp: string;
  source: string;
  payload: unknown;
}

export class AIGenerationPublisher {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private connecting = false;

  private async ensureConnection(): Promise<void> {
    if (this.channel !== null) {return;}
    if (this.connecting) {return;}

    this.connecting = true;
    try {
      this.connection = await amqplib.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange(config.rabbitmq.exchange, 'topic', {
        durable: true,
      });

      logger.info('AI publisher connected to RabbitMQ', {
        exchange: config.rabbitmq.exchange,
      });

      this.connection.on('error', (err: Error) => {
        logger.error('RabbitMQ connection error (publisher)', { error: err.message });
        this.connection = null;
        this.channel = null;
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed (publisher)');
        this.connection = null;
        this.channel = null;
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to connect to RabbitMQ (publisher)', { error: err.message });
      this.connection = null;
      this.channel = null;
      throw err;
    } finally {
      this.connecting = false;
    }
  }

  private async publish(routingKey: string, payload: unknown): Promise<void> {
    try {
      await this.ensureConnection();
    } catch {
      logger.warn('Skipping event publish — RabbitMQ unavailable', { routingKey });

      return;
    }

    if (!this.channel) {
      logger.warn('Skipping event publish — channel not available', { routingKey });

      return;
    }

    const message: AMQPMessage = {
      eventType: routingKey,
      timestamp: new Date().toISOString(),
      source: config.app.serviceName,
      payload,
    };

    try {
      const buffer = Buffer.from(JSON.stringify(message));
      this.channel.publish(config.rabbitmq.exchange, routingKey, buffer, {
        persistent: true,
        contentType: 'application/json',
      });

      logger.debug('Event published', { routingKey });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to publish event', { routingKey, error: err.message });
      // Reset connection so next call will reconnect
      this.channel = null;
      this.connection = null;
    }
  }

  async publishGenerationCompleted(
    payload: AIGenerationCompletedPayload,
  ): Promise<void> {
    await this.publish('ai.generation.completed', payload);
  }

  async publishGenerationFailed(
    payload: AIGenerationFailedPayload,
  ): Promise<void> {
    await this.publish('ai.generation.failed', payload);
  }

  async close(): Promise<void> {
    try {
      if (this.channel) {await this.channel.close();}
      if (this.connection) {await this.connection.close();}
      this.channel = null;
      this.connection = null;
      logger.info('AI publisher connection closed');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error closing AI publisher', { error: err.message });
    }
  }
}
