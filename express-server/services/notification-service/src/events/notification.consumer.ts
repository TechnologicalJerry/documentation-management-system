import amqplib, { Channel, Connection, ConsumeMessage } from 'amqplib';
import { config } from '../config';
import { logger } from '../lib/logger';
import { notificationService } from '../services/notification.service';
import { emailService } from '../services/email.service';
import { NotificationType, NotificationChannel } from '../types/notification.types';

interface BaseEvent {
  eventType: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

interface DocumentPublishedPayload {
  documentId: string;
  documentTitle: string;
  projectId: string;
  projectName: string;
  publisherId: string;
  publisherName: string;
  publisherEmail?: string;
  memberIds: string[];
  memberEmails?: Array<{ userId: string; email: string; name: string }>;
  documentUrl?: string;
}

interface ExportCompletedPayload {
  exportId: string;
  exportName: string;
  requesterId: string;
  requesterEmail: string;
  requesterName: string;
  downloadUrl: string;
  format: string;
  projectId?: string;
}

interface AIGenerationCompletedPayload {
  requestId: string;
  documentId: string;
  documentTitle: string;
  requesterId: string;
  requesterEmail: string;
  requesterName: string;
  documentUrl?: string;
  status: 'success' | 'failure';
  errorMessage?: string;
}

interface ProjectMemberAddedPayload {
  projectId: string;
  projectName: string;
  projectUrl?: string;
  newMemberId: string;
  newMemberEmail: string;
  newMemberName: string;
  inviterId: string;
  inviterName: string;
  role: string;
}

export class NotificationConsumer {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 5000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        logger.info(`RabbitMQ connection attempt ${attempt}/${MAX_RETRIES}`);
        this.connection = await amqplib.connect(config.rabbitmq.url) as unknown as Connection;
        this.channel = await (this.connection as unknown as { createChannel: () => Promise<Channel> }).createChannel();

        // Declare exchange (durable topic exchange)
        await this.channel.assertExchange(config.rabbitmq.exchange, 'topic', { durable: true });

        // Declare queue for this service
        await this.channel.assertQueue(config.rabbitmq.queue, {
          durable: true,
          arguments: {
            'x-dead-letter-exchange': `${config.rabbitmq.exchange}.dlx`,
            'x-message-ttl': 86400000, // 24h
          },
        });

        // Bind to relevant event routing keys
        const routingKeys = [
          'document.published',
          'export.completed',
          'ai.generation.completed',
          'project.member.added',
        ];

        for (const key of routingKeys) {
          await this.channel.bindQueue(config.rabbitmq.queue, config.rabbitmq.exchange, key);
          logger.debug(`Bound queue to routing key: ${key}`);
        }

        this.channel.prefetch(10);
        this.isConnected = true;

        logger.info('RabbitMQ connected successfully', { queue: config.rabbitmq.queue });

        // Set up connection error handlers
        (this.connection as unknown as { on: (event: string, cb: (err: Error) => void) => void }).on('error', (err: Error) => {
          logger.error('RabbitMQ connection error', { error: err.message });
          this.isConnected = false;
          void this.reconnect();
        });

        (this.connection as unknown as { on: (event: string, cb: () => void) => void }).on('close', () => {
          if (this.isConnected) {
            logger.warn('RabbitMQ connection closed unexpectedly');
            this.isConnected = false;
            void this.reconnect();
          }
        });

        return;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error(`RabbitMQ connection failed (attempt ${attempt}/${MAX_RETRIES})`, {
          error: err.message,
        });

        if (attempt < MAX_RETRIES) {
          await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        } else {
          logger.error('Max RabbitMQ connection retries reached');
        }
      }
    }
  }

  private async reconnect(): Promise<void> {
    logger.info('Attempting to reconnect to RabbitMQ...');
    await new Promise<void>((resolve) => setTimeout(resolve, 5000));
    await this.connect();
    await this.startConsuming();
  }

  async startConsuming(): Promise<void> {
    if (!this.channel) {
      logger.warn('Cannot start consuming — channel not initialized');

      return;
    }

    await this.channel.consume(
      config.rabbitmq.queue,
      async (msg: ConsumeMessage | null) => {
        if (!msg) {return;}

        try {
          const content = JSON.parse(msg.content.toString()) as BaseEvent;
          const routingKey = msg.fields.routingKey;

          logger.debug('Received event', { routingKey, eventType: content.eventType });

          await this.handleEvent(routingKey, content);

          this.channel!.ack(msg);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error('Error processing message', { error: err.message });

          // Nack with requeue=false (send to DLX after max retries)
          const retryCount = (msg.properties.headers?.['x-retry-count'] as number) ?? 0;
          if (retryCount < 3) {
            this.channel!.nack(msg, false, true);
          } else {
            this.channel!.nack(msg, false, false);
          }
        }
      },
      { noAck: false },
    );

    logger.info('Started consuming messages', { queue: config.rabbitmq.queue });
  }

  private async handleEvent(routingKey: string, event: BaseEvent): Promise<void> {
    switch (routingKey) {
      case 'document.published':
        await this.handleDocumentPublished(event.payload as unknown as DocumentPublishedPayload);
        break;
      case 'export.completed':
        await this.handleExportCompleted(event.payload as unknown as ExportCompletedPayload);
        break;
      case 'ai.generation.completed':
        await this.handleAIGenerationCompleted(event.payload as unknown as AIGenerationCompletedPayload);
        break;
      case 'project.member.added':
        await this.handleProjectMemberAdded(event.payload as unknown as ProjectMemberAddedPayload);
        break;
      default:
        logger.debug('Unhandled routing key', { routingKey });
    }
  }

  private async handleDocumentPublished(payload: DocumentPublishedPayload): Promise<void> {
    logger.info('Handling DocumentPublished event', { documentId: payload.documentId });

    const membersToNotify = payload.memberIds.filter((id) => id !== payload.publisherId);

    const notifications = membersToNotify.map((memberId) =>
      notificationService.createNotification({
        userId: memberId,
        type: NotificationType.DOCUMENT_PUBLISHED,
        title: `Document Published: ${payload.documentTitle}`,
        message: `${payload.publisherName} published "${payload.documentTitle}" in project "${payload.projectName}".`,
        data: {
          documentId: payload.documentId,
          projectId: payload.projectId,
          documentUrl: payload.documentUrl,
        },
        channel: NotificationChannel.IN_APP,
      }),
    );

    await Promise.allSettled(notifications);

    // Send emails to members who have email addresses
    if (payload.memberEmails && payload.memberEmails.length > 0) {
      const emailNotifications = payload.memberEmails
        .filter((m) => m.userId !== payload.publisherId)
        .map((member) =>
          emailService.sendDocumentPublishedEmail({
            recipientEmail: member.email,
            recipientName: member.name,
            documentTitle: payload.documentTitle,
            projectName: payload.projectName,
            publisherName: payload.publisherName,
            documentUrl: payload.documentUrl ?? '#',
          }),
        );

      await Promise.allSettled(emailNotifications);
    }

    logger.info('DocumentPublished notifications sent', {
      documentId: payload.documentId,
      notified: membersToNotify.length,
    });
  }

  private async handleExportCompleted(payload: ExportCompletedPayload): Promise<void> {
    logger.info('Handling ExportCompleted event', { exportId: payload.exportId });

    await notificationService.createNotification({
      userId: payload.requesterId,
      type: NotificationType.EXPORT_COMPLETED,
      title: `Export Ready: ${payload.exportName}`,
      message: `Your export "${payload.exportName}" (${payload.format}) is ready for download.`,
      data: {
        exportId: payload.exportId,
        downloadUrl: payload.downloadUrl,
        format: payload.format,
        projectId: payload.projectId,
      },
      channel: NotificationChannel.IN_APP,
      sendEmail: true,
      emailRecipient: payload.requesterEmail,
    });

    await emailService.sendExportCompletedEmail({
      recipientEmail: payload.requesterEmail,
      recipientName: payload.requesterName,
      exportName: payload.exportName,
      downloadUrl: payload.downloadUrl,
    });

    logger.info('ExportCompleted notification sent', {
      exportId: payload.exportId,
      userId: payload.requesterId,
    });
  }

  private async handleAIGenerationCompleted(payload: AIGenerationCompletedPayload): Promise<void> {
    logger.info('Handling AIGenerationCompleted event', { requestId: payload.requestId });

    const title =
      payload.status === 'success'
        ? `AI Generation Complete: ${payload.documentTitle}`
        : `AI Generation Failed: ${payload.documentTitle}`;

    const message =
      payload.status === 'success'
        ? `AI content generation for "${payload.documentTitle}" has completed successfully.`
        : `AI content generation for "${payload.documentTitle}" failed: ${payload.errorMessage ?? 'Unknown error'}`;

    await notificationService.createNotification({
      userId: payload.requesterId,
      type: NotificationType.AI_GENERATION_COMPLETED,
      title,
      message,
      data: {
        requestId: payload.requestId,
        documentId: payload.documentId,
        documentUrl: payload.documentUrl,
        status: payload.status,
      },
      channel: NotificationChannel.IN_APP,
    });

    if (payload.status === 'success') {
      await emailService.sendAiGenerationCompletedEmail({
        recipientEmail: payload.requesterEmail,
        recipientName: payload.requesterName,
        documentTitle: payload.documentTitle,
        documentUrl: payload.documentUrl ?? '#',
      });
    }

    logger.info('AIGenerationCompleted notification sent', {
      requestId: payload.requestId,
      userId: payload.requesterId,
    });
  }

  private async handleProjectMemberAdded(payload: ProjectMemberAddedPayload): Promise<void> {
    logger.info('Handling ProjectMemberAdded event', {
      projectId: payload.projectId,
      newMemberId: payload.newMemberId,
    });

    await notificationService.createNotification({
      userId: payload.newMemberId,
      type: NotificationType.PROJECT_MEMBER_ADDED,
      title: `Added to project: ${payload.projectName}`,
      message: `${payload.inviterName} added you to the project "${payload.projectName}" with role ${payload.role}.`,
      data: {
        projectId: payload.projectId,
        projectUrl: payload.projectUrl,
        inviterId: payload.inviterId,
        role: payload.role,
      },
      channel: NotificationChannel.IN_APP,
    });

    await emailService.sendProjectMemberAddedEmail({
      recipientEmail: payload.newMemberEmail,
      recipientName: payload.newMemberName,
      projectName: payload.projectName,
      inviterName: payload.inviterName,
      role: payload.role,
      projectUrl: payload.projectUrl ?? '#',
    });

    logger.info('ProjectMemberAdded notification sent', {
      projectId: payload.projectId,
      newMemberId: payload.newMemberId,
    });
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    try {
      await this.channel?.close();
      await (this.connection as unknown as { close: () => Promise<void> } | null)?.close();
      logger.info('RabbitMQ disconnected gracefully');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error during RabbitMQ disconnect', { error: err.message });
    }
  }
}

export const notificationConsumer = new NotificationConsumer();
