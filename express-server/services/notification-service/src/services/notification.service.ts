import { notificationRepository } from '../repositories/notification.repository';
import { emailService } from './email.service';
import { logger } from '../lib/logger';
import {
  CreateNotificationDto,
  Notification,
  NotificationPreferences,
  NotificationQuery,
  NotificationType,
  NotificationChannel,
  PaginatedNotifications,
  UpdatePreferencesDto,
} from '../types/notification.types';
import { config } from '../config';

export class NotificationService {
  async createNotification(dto: CreateNotificationDto): Promise<Notification> {
    // Fetch user preferences if we have a userId
    let prefs: NotificationPreferences | null = null;
    try {
      prefs = await notificationRepository.findPreferencesByUserId(dto.userId);
    } catch (err) {
      logger.warn('Could not fetch notification preferences', { userId: dto.userId });
    }

    // Check if in-app notifications are enabled
    const inAppEnabled = prefs ? prefs.inAppEnabled : true;
    const emailEnabled = prefs ? prefs.emailEnabled : true;

    // Check type-level preference
    if (prefs && !this.isTypeEnabled(prefs, dto.type)) {
      logger.debug('Notification suppressed by user preferences', {
        userId: dto.userId,
        type: dto.type,
      });
      // Still create a minimal record so the caller gets back an object
    }

    // Create in-app notification
    const notification = inAppEnabled
      ? await notificationRepository.create({
          ...dto,
          channel: dto.channel ?? NotificationChannel.IN_APP,
        })
      : await notificationRepository.create({
          ...dto,
          channel: dto.channel ?? NotificationChannel.IN_APP,
        });

    // Optionally send email
    if (dto.sendEmail && emailEnabled && dto.emailRecipient) {
      try {
        await emailService.sendEmail({
          to: dto.emailRecipient,
          subject: dto.emailSubject ?? dto.title,
          html: dto.emailHtml,
          text: dto.emailText ?? dto.message,
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error('Failed to send notification email', {
          userId: dto.userId,
          type: dto.type,
          error: error.message,
        });
        // Don't throw — in-app notification was still created
      }
    }

    logger.info('Notification created', {
      id: notification.id,
      userId: dto.userId,
      type: dto.type,
    });

    return notification;
  }

  async getNotifications(
    userId: string,
    query: NotificationQuery,
  ): Promise<PaginatedNotifications> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(
      config.pagination.maxPageSize,
      Math.max(1, query.pageSize ?? config.pagination.defaultPageSize),
    );

    const [result, unreadCount] = await Promise.all([
      notificationRepository.findByUser(userId, { ...query, page, pageSize }),
      notificationRepository.getUnreadCount(userId),
    ]);

    return {
      data: result.notifications,
      total: result.total,
      page,
      pageSize,
      totalPages: Math.ceil(result.total / pageSize),
      unreadCount,
    };
  }

  async markAsRead(id: string, userId: string): Promise<Notification | null> {
    const notification = await notificationRepository.markAsRead(id, userId);
    if (!notification) {
      logger.warn('Notification not found or not owned by user', { id, userId });

      return null;
    }

    return notification;
  }

  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const count = await notificationRepository.markAllAsRead(userId);
    logger.info('All notifications marked as read', { userId, count });

    return { updated: count };
  }

  async deleteNotification(id: string, userId: string): Promise<boolean> {
    const deleted = await notificationRepository.delete(id, userId);
    if (!deleted) {
      logger.warn('Notification not found for deletion', { id, userId });
    }

    return deleted;
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await notificationRepository.getUnreadCount(userId);

    return { count };
  }

  async updatePreferences(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<NotificationPreferences> {
    const prefs = await notificationRepository.upsertPreferences(userId, dto);
    logger.info('Notification preferences updated', { userId });

    return prefs;
  }

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const prefs = await notificationRepository.findPreferencesByUserId(userId);
    if (!prefs) {
      return notificationRepository.getDefaultPreferences(userId);
    }

    return prefs;
  }

  private isTypeEnabled(prefs: NotificationPreferences, type: NotificationType): boolean {
    switch (type) {
      case NotificationType.DOCUMENT_PUBLISHED:
      case NotificationType.DOCUMENT_UPDATED:
      case NotificationType.DOCUMENT_COMMENTED:
        return prefs.documentUpdates;
      case NotificationType.EXPORT_COMPLETED:
        return prefs.exportsCompleted;
      case NotificationType.AI_GENERATION_COMPLETED:
        return prefs.aiCompletions;
      case NotificationType.PROJECT_MEMBER_ADDED:
      case NotificationType.PROJECT_UPDATED:
        return prefs.projectUpdates;
      case NotificationType.TEAM_UPDATED:
        return prefs.teamUpdates;
      default:
        return true;
    }
  }
}

export const notificationService = new NotificationService();
