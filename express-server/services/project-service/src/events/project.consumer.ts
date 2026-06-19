import amqplib, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { config } from '../config';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';

interface UserDeletedPayload {
  userId: string;
}

interface UserUpdatedPayload {
  userId: string;
  email?: string;
  displayName?: string;
}

interface UserEvent<T = unknown> {
  eventType: string;
  userId: string;
  timestamp: string;
  payload: T;
}

export class ProjectConsumer {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private readonly exchange: string;
  private readonly queue: string;
  private readonly url: string;

  constructor() {
    this.exchange = config.rabbitmq.exchange;
    this.queue = config.rabbitmq.queues.project;
    this.url = config.rabbitmq.url;
  }

  async connect(): Promise<void> {
    try {
      this.connection = await amqplib.connect(this.url);
      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange(this.exchange, 'topic', { durable: true });
      await this.channel.assertQueue(this.queue, { durable: true });

      // Bind to user events
      await this.channel.bindQueue(this.queue, this.exchange, 'user.deleted');
      await this.channel.bindQueue(this.queue, this.exchange, 'user.updated');

      // Process one message at a time
      this.channel.prefetch(1);

      this.connection.on('error', (err) => {
        logger.error('RabbitMQ consumer connection error', { error: err });
        void this.reconnect();
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ consumer connection closed, reconnecting...');
        void this.reconnect();
      });

      logger.info('RabbitMQ consumer connected', { queue: this.queue });
    } catch (error) {
      logger.error('Failed to connect RabbitMQ consumer', { error });
      throw error;
    }
  }

  async startConsuming(): Promise<void> {
    if (this.channel === null) {
      throw new Error('Consumer not connected');
    }

    await this.channel.consume(this.queue, (msg) => {
      if (msg !== null) {
        void this.handleMessage(msg);
      }
    });

    logger.info('Consumer started', { queue: this.queue });
  }

  async disconnect(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (error) {
      logger.error('Error closing RabbitMQ consumer', { error });
    } finally {
      this.channel = null;
      this.connection = null;
    }
  }

  private async handleMessage(msg: ConsumeMessage): Promise<void> {
    const routingKey = msg.fields.routingKey;

    try {
      const content = JSON.parse(msg.content.toString()) as UserEvent;

      logger.debug('Received event', { routingKey, eventType: content.eventType });

      switch (routingKey) {
        case 'user.deleted':
          await this.handleUserDeleted(content as UserEvent<UserDeletedPayload>);
          break;

        case 'user.updated':
          await this.handleUserUpdated(content as UserEvent<UserUpdatedPayload>);
          break;

        default:
          logger.warn('Unhandled event routing key', { routingKey });
      }

      this.channel?.ack(msg);
    } catch (error) {
      logger.error('Failed to process message', { routingKey, error });
      // Nack with requeue=false for parse errors, requeue=true for transient errors
      const isParseError = error instanceof SyntaxError;
      this.channel?.nack(msg, false, !isParseError);
    }
  }

  private async handleUserDeleted(event: UserEvent<UserDeletedPayload>): Promise<void> {
    const { userId } = event.payload;

    logger.info('Handling user.deleted event', { userId });

    try {
      // Remove user from all project memberships
      await prisma.projectMember.deleteMany({
        where: { userId },
      });

      // Transfer ownership or archive projects owned by deleted user
      const ownedProjects = await prisma.project.findMany({
        where: { ownerId: userId, deletedAt: null },
        include: { members: true },
      });

      for (const project of ownedProjects) {
        // Find the highest-ranked remaining member
        const nextOwner = project.members.find(
          (m) => m.userId !== userId && m.role !== 'OWNER',
        );

        if (nextOwner !== undefined) {
          await prisma.$transaction([
            prisma.project.update({
              where: { id: project.id },
              data: { ownerId: nextOwner.userId },
            }),
            prisma.projectMember.update({
              where: { projectId_userId: { projectId: project.id, userId: nextOwner.userId } },
              data: { role: 'OWNER' },
            }),
          ]);
          logger.info('Project ownership transferred', {
            projectId: project.id,
            newOwnerId: nextOwner.userId,
          });
        } else {
          // No other members — archive the project
          await prisma.project.update({
            where: { id: project.id },
            data: { status: 'ARCHIVED' },
          });
          logger.info('Project archived due to owner deletion', { projectId: project.id });
        }
      }

      logger.info('User deleted event processed', { userId });
    } catch (error) {
      logger.error('Failed to handle user.deleted event', { userId, error });
      throw error;
    }
  }

  private async handleUserUpdated(event: UserEvent<UserUpdatedPayload>): Promise<void> {
    const { userId } = event.payload;

    // The project service doesn't store user profile data beyond userId,
    // so there's nothing to update. Log for observability.
    logger.info('Handling user.updated event (no-op for project service)', { userId });
  }

  private async reconnect(): Promise<void> {
    const maxRetries = 5;
    const delayMs = 5000;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
        await this.connect();
        await this.startConsuming();
        logger.info('RabbitMQ consumer reconnected');

        return;
      } catch (error) {
        retries++;
        logger.error(`RabbitMQ reconnect attempt ${retries}/${maxRetries} failed`, { error });
      }
    }

    logger.error('RabbitMQ consumer failed to reconnect after max retries');
  }
}
