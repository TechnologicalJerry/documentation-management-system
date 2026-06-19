import { v4 as uuidv4 } from 'uuid';
import { db } from '../lib/knex';
import { logger } from '../lib/logger';
import {
  Notification,
  NotificationPreferences,
  CreateNotificationDto,
  NotificationQuery,
  NotificationChannel,
  NotificationType,
  UpdatePreferencesDto,
} from '../types/notification.types';
import { config } from '../config';

const NOTIFICATIONS_TABLE = 'notifications';
const PREFERENCES_TABLE = 'notification_preferences';

function rowToNotification(row: Record<string, unknown>): Notification {
  return {
    id: row['id'] as string,
    userId: row['user_id'] as string,
    type: row['type'] as NotificationType,
    title: row['title'] as string,
    message: (row['message'] as string | null) ?? null,
    data: row['data'] ? (typeof row['data'] === 'string' ? JSON.parse(row['data']) : (row['data'] as Record<string, unknown>)) : null,
    channel: row['channel'] as NotificationChannel,
    isRead: Boolean(row['is_read']),
    readAt: row['read_at'] ? new Date(row['read_at'] as string) : null,
    createdAt: new Date(row['created_at'] as string),
  };
}

function rowToPreferences(row: Record<string, unknown>): NotificationPreferences {
  return {
    id: row['id'] as string,
    userId: row['user_id'] as string,
    emailEnabled: Boolean(row['email_enabled']),
    inAppEnabled: Boolean(row['in_app_enabled']),
    documentUpdates: Boolean(row['document_updates']),
    projectUpdates: Boolean(row['project_updates']),
    teamUpdates: Boolean(row['team_updates']),
    aiCompletions: Boolean(row['ai_completions']),
    exportsCompleted: Boolean(row['exports_completed']),
    createdAt: new Date(row['created_at'] as string),
    updatedAt: new Date(row['updated_at'] as string),
  };
}

export class NotificationRepository {
  async create(dto: CreateNotificationDto): Promise<Notification> {
    const id = uuidv4();
    const now = new Date();

    const row = {
      id,
      user_id: dto.userId,
      type: dto.type,
      title: dto.title,
      message: dto.message ?? null,
      data: dto.data ? JSON.stringify(dto.data) : null,
      channel: dto.channel ?? NotificationChannel.IN_APP,
      is_read: false,
      read_at: null,
      created_at: now,
    };

    await db(NOTIFICATIONS_TABLE).insert(row);
    logger.debug('Notification created', { id, userId: dto.userId, type: dto.type });

    return {
      id,
      userId: dto.userId,
      type: dto.type,
      title: dto.title,
      message: dto.message ?? null,
      data: dto.data ?? null,
      channel: dto.channel ?? NotificationChannel.IN_APP,
      isRead: false,
      readAt: null,
      createdAt: now,
    };
  }

  async findById(id: string): Promise<Notification | null> {
    const row = await db(NOTIFICATIONS_TABLE).where({ id }).first();
    if (!row) {return null;}

    return rowToNotification(row as Record<string, unknown>);
  }

  async findByUser(
    userId: string,
    query: NotificationQuery,
  ): Promise<{ notifications: Notification[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(
      config.pagination.maxPageSize,
      Math.max(1, query.pageSize ?? config.pagination.defaultPageSize),
    );
    const offset = (page - 1) * pageSize;

    let baseQuery = db(NOTIFICATIONS_TABLE).where({ user_id: userId });

    if (query.isRead !== undefined) {
      baseQuery = baseQuery.where({ is_read: query.isRead });
    }
    if (query.type != null) {
      baseQuery = baseQuery.where({ type: query.type });
    }
    if (query.channel != null) {
      baseQuery = baseQuery.where({ channel: query.channel });
    }

    const [countResult, rows] = await Promise.all([
      baseQuery.clone().count('id as count').first(),
      baseQuery
        .clone()
        .orderBy('created_at', 'desc')
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number((countResult as Record<string, unknown>)['count'] ?? 0);
    const notifications = (rows as Record<string, unknown>[]).map(rowToNotification);

    return { notifications, total };
  }

  async markAsRead(id: string, userId: string): Promise<Notification | null> {
    const now = new Date();
    const updated = await db(NOTIFICATIONS_TABLE)
      .where({ id, user_id: userId })
      .update({ is_read: true, read_at: now });

    if (updated === 0) {return null;}

    return this.findById(id);
  }

  async markAllAsRead(userId: string): Promise<number> {
    const now = new Date();
    const count = await db(NOTIFICATIONS_TABLE)
      .where({ user_id: userId, is_read: false })
      .update({ is_read: true, read_at: now });

    return count;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const deleted = await db(NOTIFICATIONS_TABLE)
      .where({ id, user_id: userId })
      .delete();

    return deleted > 0;
  }

  async getUnreadCount(userId: string): Promise<number> {
    const result = await db(NOTIFICATIONS_TABLE)
      .where({ user_id: userId, is_read: false })
      .count('id as count')
      .first();

    return Number((result as Record<string, unknown>)?.['count'] ?? 0);
  }

  async deleteOlderThan(date: Date): Promise<number> {
    return db(NOTIFICATIONS_TABLE)
      .where('created_at', '<', date)
      .where({ is_read: true })
      .delete();
  }

  // Preferences

  async findPreferencesByUserId(userId: string): Promise<NotificationPreferences | null> {
    const row = await db(PREFERENCES_TABLE).where({ user_id: userId }).first();
    if (!row) {return null;}

    return rowToPreferences(row as Record<string, unknown>);
  }

  async upsertPreferences(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<NotificationPreferences> {
    const existing = await this.findPreferencesByUserId(userId);

    if (existing) {
      const updateData: Record<string, unknown> = { updated_at: new Date() };
      if (dto.emailEnabled !== undefined) {updateData['email_enabled'] = dto.emailEnabled;}
      if (dto.inAppEnabled !== undefined) {updateData['in_app_enabled'] = dto.inAppEnabled;}
      if (dto.documentUpdates !== undefined) {updateData['document_updates'] = dto.documentUpdates;}
      if (dto.projectUpdates !== undefined) {updateData['project_updates'] = dto.projectUpdates;}
      if (dto.teamUpdates !== undefined) {updateData['team_updates'] = dto.teamUpdates;}
      if (dto.aiCompletions !== undefined) {updateData['ai_completions'] = dto.aiCompletions;}
      if (dto.exportsCompleted !== undefined) {updateData['exports_completed'] = dto.exportsCompleted;}

      await db(PREFERENCES_TABLE).where({ user_id: userId }).update(updateData);
      const updated = await this.findPreferencesByUserId(userId);

      return updated!;
    }

    const id = uuidv4();
    const now = new Date();
    const row = {
      id,
      user_id: userId,
      email_enabled: dto.emailEnabled ?? true,
      in_app_enabled: dto.inAppEnabled ?? true,
      document_updates: dto.documentUpdates ?? true,
      project_updates: dto.projectUpdates ?? true,
      team_updates: dto.teamUpdates ?? true,
      ai_completions: dto.aiCompletions ?? true,
      exports_completed: dto.exportsCompleted ?? true,
      created_at: now,
      updated_at: now,
    };

    await db(PREFERENCES_TABLE).insert(row);

    return {
      id,
      userId,
      emailEnabled: row.email_enabled,
      inAppEnabled: row.in_app_enabled,
      documentUpdates: row.document_updates,
      projectUpdates: row.project_updates,
      teamUpdates: row.team_updates,
      aiCompletions: row.ai_completions,
      exportsCompleted: row.exports_completed,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getDefaultPreferences(userId: string): Promise<NotificationPreferences> {
    const id = uuidv4();
    const now = new Date();

    return {
      id,
      userId,
      emailEnabled: true,
      inAppEnabled: true,
      documentUpdates: true,
      projectUpdates: true,
      teamUpdates: true,
      aiCompletions: true,
      exportsCompleted: true,
      createdAt: now,
      updatedAt: now,
    };
  }
}

export const notificationRepository = new NotificationRepository();
