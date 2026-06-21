import amqplib, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { UserRepository } from '../repositories/user.repository';
import { CreateUserDto } from '../types/user.types';
import { config } from '../config';
import { logger } from '../utils/logger';

// ─── Event Payloads ────────────────────────────────────────────────────────────

interface UserCreatedEvent {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId?: string;
  timestamp: string;
}

interface UserDeletedEvent {
  userId: string;
  timestamp: string;
}

interface AuthEvent {
  type: 'UserCreated' | 'UserDeleted' | 'UserUpdated';
  payload: UserCreatedEvent | UserDeletedEvent;
}

// ─── Consumer ─────────────────────────────────────────────────────────────────

export class UserEventConsumer {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private readonly userRepository: UserRepository;

  private readonly exchange = 'auth.events';
  private readonly queue = 'user-service.auth-events';
  private readonly routingKeys = ['auth.user.created', 'auth.user.deleted'];

  constructor() {
    this.userRepository = new UserRepository();
  }

  async connect(): Promise<void> {
    try {
      this.connection = await amqplib.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();

      logger.info('RabbitMQ connection established', { exchange: this.exchange });

      // Set prefetch to process one message at a time
      await this.channel.prefetch(1);

      // Assert exchange
      await this.channel.assertExchange(this.exchange, 'topic', { durable: true });

      // Assert queue with dead-letter exchange
      await this.channel.assertExchange('user-service.dlx', 'direct', { durable: true });
      await this.channel.assertQueue('user-service.dead-letters', { durable: true });
      await this.channel.bindQueue('user-service.dead-letters', 'user-service.dlx', '#');

      await this.channel.assertQueue(this.queue, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'user-service.dlx',
          'x-dead-letter-routing-key': this.queue,
          'x-message-ttl': 86400000, // 24 hours
        },
      });

      // Bind routing keys
      for (const key of this.routingKeys) {
        await this.channel.bindQueue(this.queue, this.exchange, key);
        logger.info('Bound queue to routing key', { queue: this.queue, key });
      }

      this.connection.on('error', (err: Error) => {
        logger.error('RabbitMQ connection error', { error: err.message });
        void this.reconnect();
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed. Attempting reconnect...');
        void this.reconnect();
      });

      logger.info('Starting to consume events', { queue: this.queue });
    } catch (err) {
      logger.error('Failed to connect to RabbitMQ', { error: err });
      // Non-fatal: service continues without event consumption
    }
  }

  async startConsuming(): Promise<void> {
    if (!this.channel) {
      logger.warn('Cannot start consuming: channel not initialized');

      return;
    }

    await this.channel.consume(
      this.queue,
      (msg: ConsumeMessage | null) => {
        if (!msg) {return;}
        void this.handleMessage(msg);
      },
      { noAck: false },
    );

    logger.info('Event consumer started', { queue: this.queue });
  }

  private async handleMessage(msg: ConsumeMessage): Promise<void> {
    const channel = this.channel;
    if (!channel) {return;}

    try {
      const raw = msg.content.toString('utf-8');
      const event = JSON.parse(raw) as AuthEvent;

      logger.debug('Received event', { type: event.type, routingKey: msg.fields.routingKey });

      switch (event.type) {
        case 'UserCreated':
          await this.handleUserCreated(event.payload as UserCreatedEvent);
          break;
        case 'UserDeleted':
          await this.handleUserDeleted(event.payload as UserDeletedEvent);
          break;
        default:
          logger.warn('Unknown event type', { type: (event).type });
      }

      channel.ack(msg);
    } catch (err) {
      logger.error('Error processing event', {
        error: err instanceof Error ? err.message : err,
        messageId: msg.properties.messageId,
      });

      // Nack and requeue once; after that, send to DLX
      const redelivered = msg.fields.redelivered;
      channel.nack(msg, false, !redelivered);
    }
  }

  private async handleUserCreated(payload: UserCreatedEvent): Promise<void> {
    logger.info('Processing UserCreated event', { userId: payload.userId });

    // Check if user profile already exists (idempotency)
    const existing = await this.userRepository.findById(payload.userId);
    if (existing) {
      logger.info('User profile already exists, skipping', { userId: payload.userId });

      return;
    }

    const dto: CreateUserDto = {
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      organizationId: payload.organizationId,
    };

    await this.userRepository.create(dto);
    logger.info('User profile created from auth event', { userId: payload.userId });
  }

  private async handleUserDeleted(payload: UserDeletedEvent): Promise<void> {
    logger.info('Processing UserDeleted event', { userId: payload.userId });

    const existing = await this.userRepository.findById(payload.userId);
    if (!existing) {
      logger.info('User profile not found, skipping delete', { userId: payload.userId });

      return;
    }

    await this.userRepository.softDelete(payload.userId);
    logger.info('User profile soft-deleted from auth event', { userId: payload.userId });
  }

  private async reconnect(): Promise<void> {
    const delay = (ms: number): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, ms));

    for (let attempt = 1; attempt <= 5; attempt++) {
      logger.info(`RabbitMQ reconnect attempt ${attempt}/5`);
      await delay(attempt * 2000);

      try {
        await this.connect();
        await this.startConsuming();
        logger.info('RabbitMQ reconnected successfully');

        return;
      } catch (err) {
        logger.error(`Reconnect attempt ${attempt} failed`, { error: err });
      }
    }

    logger.error('RabbitMQ reconnection exhausted. Event consumption disabled.');
  }

  async disconnect(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
      logger.info('RabbitMQ disconnected cleanly');
    } catch (err) {
      logger.error('Error disconnecting from RabbitMQ', { error: err });
    }
  }
}
