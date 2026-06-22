import { Channel, ConsumeMessage } from 'amqplib';
import { DomainEvent } from '@devdocs/shared-types';
import { RabbitMQClient, LoggerLike } from './rabbitmq.client';
import { EXCHANGES } from './exchanges';

export type EventHandler<T extends DomainEvent = DomainEvent> = (
  event: T,
  rawMessage: ConsumeMessage,
) => Promise<void>;

export interface SubscribeOptions {
  /** If true, the broker will not expect ack. Default: false (manual ack) */
  noAck?: boolean;
  /** Number of messages to prefetch per consumer */
  prefetch?: number;
  /** Routing key pattern (supports AMQP wildcards: * and #) */
  routingKey?: string;
  /** Dead letter exchange for failed messages */
  deadLetterExchange?: string;
  /** Max retry count before sending to DLQ */
  maxRetries?: number;
}

export interface ConsumerSubscription {
  consumerTag: string;
  queueName: string;
  channelId: string;
  cancel: () => Promise<void>;
}

export interface ConsumerOptions {
  serviceName: string;
  logger?: LoggerLike;
}

/**
 * EventConsumer wraps RabbitMQClient to provide a typed, easy-to-use
 * interface for consuming domain events.
 */
export class EventConsumer {
  private readonly client: RabbitMQClient;
  private readonly serviceName: string;
  private readonly logger: LoggerLike;
  private subscriptions: Map<string, ConsumerSubscription> = new Map();

  constructor(client: RabbitMQClient, options: ConsumerOptions) {
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
   * Subscribe to a queue and process messages with the given handler.
   * Supports auto-binding to an exchange with a routing key.
   */
  async subscribe<T extends DomainEvent>(
    queueName: string,
    handler: EventHandler<T>,
    options: SubscribeOptions = {},
  ): Promise<ConsumerSubscription> {
    const channelId = `${queueName}-${Date.now()}`;
    const channel = await this.client.createConsumerChannel(channelId);

    if (options.prefetch !== undefined) {
      await channel.prefetch(options.prefetch);
    }

    // Bind queue to exchange if routingKey provided
    if (options.routingKey) {
      const exchangeName = this.inferExchangeFromQueue(queueName);
      if (exchangeName) {
        await channel.bindQueue(queueName, exchangeName, options.routingKey);
        this.logger.debug(`[EventConsumer] Bound ${queueName} to ${exchangeName}#${options.routingKey}`);
      }
    }

    const { consumerTag } = await channel.consume(
      queueName,
      (msg: ConsumeMessage | null) => {
        if (!msg) {
          this.logger.warn(`[EventConsumer] Consumer cancelled by broker for queue: ${queueName}`);
          return;
        }

        this.processMessage(channel, msg, handler, options).catch((err: Error) => {
          this.logger.error('[EventConsumer] Unhandled error in processMessage', {
            error: err.message,
            queue: queueName,
          });
        });
      },
      { noAck: options.noAck ?? false },
    );

    const subscription: ConsumerSubscription = {
      consumerTag,
      queueName,
      channelId,
      cancel: async () => {
        try {
          await channel.cancel(consumerTag);
          this.subscriptions.delete(consumerTag);
        } catch (err) {
          this.logger.warn('[EventConsumer] Failed to cancel consumer', {
            consumerTag,
            error: (err as Error).message,
          });
        }
      },
    };

    this.subscriptions.set(consumerTag, subscription);

    this.logger.info(`[EventConsumer] Subscribed to queue: ${queueName}`, {
      consumerTag,
      service: this.serviceName,
    });

    return subscription;
  }

  private async processMessage<T extends DomainEvent>(
    channel: Channel,
    msg: ConsumeMessage,
    handler: EventHandler<T>,
    options: SubscribeOptions,
  ): Promise<void> {
    const maxRetries = options.maxRetries ?? 3;
    const retryCount = (msg.properties.headers?.['x-retry-count'] as number) ?? 0;

    let event: T;

    try {
      const content = msg.content.toString('utf-8');
      event = JSON.parse(content) as T;
    } catch (parseError) {
      this.logger.error('[EventConsumer] Failed to parse message', {
        error: (parseError as Error).message,
        content: msg.content.toString('utf-8').slice(0, 200),
      });
      // Reject without requeue — malformed messages go to DLQ
      if (!options.noAck) channel.nack(msg, false, false);
      return;
    }

    this.logger.debug('[EventConsumer] Processing event', {
      eventType: event.eventType,
      eventId: event.eventId,
      correlationId: event.correlationId,
    });

    try {
      await handler(event, msg);
      if (!options.noAck) channel.ack(msg);

      this.logger.debug('[EventConsumer] Event processed successfully', {
        eventType: event.eventType,
        eventId: event.eventId,
      });
    } catch (handlerError) {
      const err = handlerError as Error;
      this.logger.error('[EventConsumer] Handler failed to process event', {
        eventType: event.eventType,
        eventId: event.eventId,
        error: err.message,
        retryCount,
      });

      if (!options.noAck) {
        if (retryCount < maxRetries) {
          // Nack with requeue to retry
          this.logger.warn(
            `[EventConsumer] Requeueing event (attempt ${retryCount + 1}/${maxRetries})`,
            { eventId: event.eventId },
          );
          channel.nack(msg, false, true);
        } else {
          // Send to dead letter queue after max retries
          this.logger.error(
            `[EventConsumer] Max retries exceeded for event ${event.eventId}. Sending to DLQ.`,
          );
          channel.nack(msg, false, false);
        }
      }
    }
  }

  /**
   * Infer the exchange name from the queue name convention.
   * Queue names follow pattern: <service>.<domain>-events
   */
  private inferExchangeFromQueue(queueName: string): string | null {
    if (queueName.includes('user')) return EXCHANGES.USERS.name;
    if (queueName.includes('project')) return EXCHANGES.PROJECTS.name;
    if (queueName.includes('document')) return EXCHANGES.DOCUMENTS.name;
    if (queueName.includes('export')) return EXCHANGES.EXPORTS.name;
    if (queueName.includes('ai')) return EXCHANGES.AI.name;
    if (queueName.includes('notification')) return EXCHANGES.NOTIFICATIONS.name;
    if (queueName.includes('audit')) return EXCHANGES.AUDIT.name;
    return null;
  }

  /**
   * Cancel all active subscriptions gracefully.
   */
  async cancelAll(): Promise<void> {
    this.logger.info('[EventConsumer] Cancelling all subscriptions');
    const cancelPromises = Array.from(this.subscriptions.values()).map((sub) => sub.cancel());
    await Promise.allSettled(cancelPromises);
    this.subscriptions.clear();
  }

  get activeSubscriptions(): ConsumerSubscription[] {
    return Array.from(this.subscriptions.values());
  }
}
