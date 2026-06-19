import amqplib, { Channel, ChannelModel, Options } from 'amqplib';
import { MemberRole } from '@prisma/client';
import { config } from '../config';
import { logger } from '../lib/logger';
import {
  MemberAddedPayload,
  MemberRemovedPayload,
  MemberRoleChangedPayload,
  ProjectCreatedPayload,
  ProjectDeletedPayload,
  ProjectEvent,
  ProjectResponseDto,
  ProjectUpdatedPayload,
  UpdateProjectDto,
} from '../types/project.types';

export class ProjectPublisher {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private connecting = false;
  private readonly exchange: string;
  private readonly url: string;

  constructor() {
    this.exchange = config.rabbitmq.exchange;
    this.url = config.rabbitmq.url;
  }

  async connect(): Promise<void> {
    if (this.channel !== null || this.connecting) {
      return;
    }

    this.connecting = true;

    try {
      this.connection = await amqplib.connect(this.url);
      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange(this.exchange, 'topic', { durable: true });

      this.connection.on('error', (err) => {
        logger.error('RabbitMQ connection error', { error: err });
        this.reset();
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        this.reset();
      });

      logger.info('RabbitMQ publisher connected', { exchange: this.exchange });
    } catch (error) {
      logger.error('Failed to connect RabbitMQ publisher', { error });
      this.reset();
      throw error;
    } finally {
      this.connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (error) {
      logger.error('Error closing RabbitMQ publisher', { error });
    } finally {
      this.reset();
    }
  }

  async publishProjectCreated(project: ProjectResponseDto, actorId: string): Promise<void> {
    const event: ProjectEvent<ProjectCreatedPayload> = {
      eventType: 'project.created',
      projectId: project.id,
      actorId,
      timestamp: new Date().toISOString(),
      payload: { project },
    };

    await this.publish('project.created', event);
  }

  async publishProjectUpdated(
    projectId: string,
    changes: Partial<UpdateProjectDto>,
    actorId: string,
  ): Promise<void> {
    const event: ProjectEvent<ProjectUpdatedPayload> = {
      eventType: 'project.updated',
      projectId,
      actorId,
      timestamp: new Date().toISOString(),
      payload: { projectId, changes },
    };

    await this.publish('project.updated', event);
  }

  async publishProjectDeleted(projectId: string, actorId: string): Promise<void> {
    const event: ProjectEvent<ProjectDeletedPayload> = {
      eventType: 'project.deleted',
      projectId,
      actorId,
      timestamp: new Date().toISOString(),
      payload: { projectId, ownerId: actorId },
    };

    await this.publish('project.deleted', event);
  }

  async publishMemberAdded(
    projectId: string,
    userId: string,
    role: MemberRole,
    actorId: string,
  ): Promise<void> {
    const event: ProjectEvent<MemberAddedPayload> = {
      eventType: 'project.member.added',
      projectId,
      actorId,
      timestamp: new Date().toISOString(),
      payload: { projectId, userId, role },
    };

    await this.publish('project.member.added', event);
  }

  async publishMemberRemoved(
    projectId: string,
    userId: string,
    actorId: string,
  ): Promise<void> {
    const event: ProjectEvent<MemberRemovedPayload> = {
      eventType: 'project.member.removed',
      projectId,
      actorId,
      timestamp: new Date().toISOString(),
      payload: { projectId, userId },
    };

    await this.publish('project.member.removed', event);
  }

  async publishMemberRoleChanged(
    projectId: string,
    userId: string,
    oldRole: MemberRole,
    newRole: MemberRole,
    actorId: string,
  ): Promise<void> {
    const event: ProjectEvent<MemberRoleChangedPayload> = {
      eventType: 'project.member.role_changed',
      projectId,
      actorId,
      timestamp: new Date().toISOString(),
      payload: { projectId, userId, oldRole, newRole },
    };

    await this.publish('project.member.role_changed', event);
  }

  async publishInvitationSent(
    projectId: string,
    email: string,
    token: string,
    actorId: string,
  ): Promise<void> {
    const event: ProjectEvent<{ projectId: string; email: string; token: string }> = {
      eventType: 'project.invitation.sent',
      projectId,
      actorId,
      timestamp: new Date().toISOString(),
      payload: { projectId, email, token },
    };

    await this.publish('project.invitation.sent', event);
  }

  async publishInvitationAccepted(
    projectId: string,
    userId: string,
    invitedBy: string,
  ): Promise<void> {
    const event: ProjectEvent<{ projectId: string; userId: string }> = {
      eventType: 'project.invitation.accepted',
      projectId,
      actorId: userId,
      timestamp: new Date().toISOString(),
      payload: { projectId, userId },
    };

    await this.publish('project.invitation.accepted', event);
    logger.debug('Invitation accepted event published by', { invitedBy });
  }

  private async publish(routingKey: string, message: unknown): Promise<void> {
    if (this.channel === null) {
      try {
        await this.connect();
      } catch {
        logger.warn('Publisher not connected, skipping event', { routingKey });

        return;
      }
    }

    if (this.channel === null) {
      return;
    }

    const content = Buffer.from(JSON.stringify(message));
    const options: Options.Publish = {
      persistent: true,
      contentType: 'application/json',
      timestamp: Date.now(),
    };

    const published = this.channel.publish(this.exchange, routingKey, content, options);
    if (!published) {
      logger.warn('Channel buffer full, message may be dropped', { routingKey });
    }

    logger.debug('Event published', { routingKey, exchange: this.exchange });
  }

  private reset(): void {
    this.channel = null;
    this.connection = null;
    this.connecting = false;
  }
}
