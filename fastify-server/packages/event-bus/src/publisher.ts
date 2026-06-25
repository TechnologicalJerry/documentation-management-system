import { v4 as uuidv4 } from 'uuid';
import { BaseEvent, DomainEvent } from '@devdocs/shared-types';
import { RabbitMQClient, LoggerLike } from './rabbitmq.client';
import { EXCHANGES } from './exchanges';

export interface PublishOptions {
  persistent?: boolean;
  correlationId?: string;
  causationId?: string;
  headers?: Record<string, unknown>;
  expiration?: number; // TTL in milliseconds
  priority?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
}

export interface PublisherOptions {
  serviceName: string;
  logger?: LoggerLike;
}

/**
 * EventPublisher wraps RabbitMQClient to provide a typed, easy-to-use
 * interface for publishing domain events.
 */
export class EventPublisher {
  private readonly client: RabbitMQClient;
  private readonly serviceName: string;
  private readonly logger: LoggerLike;

  constructor(client: RabbitMQClient, options: PublisherOptions) {
    this.client = client;
    this.serviceName = options.serviceName;
    this.logger = options.logger ?? {
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
    };
  }

  /**
   * Publish a fully-formed domain event.
   */
  async publish(
    event: DomainEvent,
    exchangeName: string,
    routingKey: string,
    options: PublishOptions = {},
  ): Promise<void> {
    const channel = this.client.getPublishChannel();

    const message = Buffer.from(JSON.stringify(event));

    const publishOptions: Record<string, unknown> = {
      persistent: options.persistent ?? true,
      contentType: 'application/json',
      contentEncoding: 'utf-8',
      timestamp: Math.floor(Date.now() / 1000),
      messageId: event.eventId,
      correlationId: options.correlationId ?? event.correlationId,
      headers: {
        'x-event-type': event.eventType,
        'x-source-service': event.source,
        'x-event-version': event.version,
        ...options.headers,
      },
    };

    if (options.expiration !== undefined) {
      publishOptions['expiration'] = String(options.expiration);
    }

    if (options.priority !== undefined) {
      publishOptions['priority'] = options.priority;
    }

    return new Promise<void>((resolve, reject) => {
      const published = channel.publish(
        exchangeName,
        routingKey,
        message,
        publishOptions as import('amqplib').Options.Publish,
        (err: Error | null) => {
          if (err) {
            this.logger.error('[EventPublisher] Failed to publish event', {
              eventType: event.eventType,
              eventId: event.eventId,
              error: err.message,
            });
            reject(err);
            return;
          }
          this.logger.debug('[EventPublisher] Event published', {
            eventType: event.eventType,
            eventId: event.eventId,
            exchange: exchangeName,
            routingKey,
          });
          resolve();
        },
      );

      if (!published) {
        reject(new Error('[EventPublisher] Channel buffer full — back pressure applied'));
      }
    });
  }

  /**
   * Build and publish a typed event with auto-generated metadata.
   */
  async publishEvent<T extends Omit<DomainEvent, keyof BaseEvent>>(
    eventType: DomainEvent['eventType'],
    eventPayload: T,
    exchangeName: string,
    routingKey: string,
    options: PublishOptions & { correlationId?: string; causationId?: string } = {},
  ): Promise<string> {
    const eventId = uuidv4();

    const event: BaseEvent = {
      eventId,
      eventType,
      correlationId: options.correlationId ?? uuidv4(),
      causationId: options.causationId,
      timestamp: new Date().toISOString(),
      version: 1,
      source: this.serviceName,
      ...(eventPayload as Record<string, unknown>),
    } as unknown as BaseEvent;

    await this.publish(event as DomainEvent, exchangeName, routingKey, options);
    return eventId;
  }

  /**
   * Publish to the users exchange
   */
  async publishUserEvent(
    event: DomainEvent,
    routingKey: string,
    options?: PublishOptions,
  ): Promise<void> {
    return this.publish(event, EXCHANGES.USERS.name, routingKey, options);
  }

  /**
   * Publish to the projects exchange
   */
  async publishProjectEvent(
    event: DomainEvent,
    routingKey: string,
    options?: PublishOptions,
  ): Promise<void> {
    return this.publish(event, EXCHANGES.PROJECTS.name, routingKey, options);
  }

  /**
   * Publish to the documents exchange
   */
  async publishDocumentEvent(
    event: DomainEvent,
    routingKey: string,
    options?: PublishOptions,
  ): Promise<void> {
    return this.publish(event, EXCHANGES.DOCUMENTS.name, routingKey, options);
  }

  /**
   * Publish a notification event
   */
  async publishNotification(
    event: DomainEvent,
    routingKey: string,
    options?: PublishOptions,
  ): Promise<void> {
    return this.publish(event, EXCHANGES.NOTIFICATIONS.name, routingKey, options);
  }

  /**
   * Publish an audit log event (fanout — no routing key needed)
   */
  async publishAuditEvent(event: DomainEvent, options?: PublishOptions): Promise<void> {
    return this.publish(event, EXCHANGES.AUDIT.name, '', options);
  }

  /**
   * Publish an AI generation event
   */
  async publishAIEvent(
    event: DomainEvent,
    routingKey: string,
    options?: PublishOptions,
  ): Promise<void> {
    return this.publish(event, EXCHANGES.AI.name, routingKey, options);
  }

  /**
   * Publish an export event
   */
  async publishExportEvent(
    event: DomainEvent,
    routingKey: string,
    options?: PublishOptions,
  ): Promise<void> {
    return this.publish(event, EXCHANGES.EXPORTS.name, routingKey, options);
  }
}
