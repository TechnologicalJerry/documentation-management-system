export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  PUSH = 'push',
}

export enum NotificationType {
  DOCUMENT_PUBLISHED = 'document_published',
  DOCUMENT_UPDATED = 'document_updated',
  DOCUMENT_COMMENTED = 'document_commented',
  EXPORT_COMPLETED = 'export_completed',
  AI_GENERATION_COMPLETED = 'ai_generation_completed',
  PROJECT_MEMBER_ADDED = 'project_member_added',
  PROJECT_UPDATED = 'project_updated',
  TEAM_UPDATED = 'team_updated',
  MENTION = 'mention',
  SYSTEM = 'system',
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string | null;
  data: Record<string, unknown> | null;
  channel: NotificationChannel;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationPreferences {
  id: string;
  userId: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  documentUpdates: boolean;
  projectUpdates: boolean;
  teamUpdates: boolean;
  aiCompletions: boolean;
  exportsCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  data?: Record<string, unknown>;
  channel?: NotificationChannel;
  sendEmail?: boolean;
  emailRecipient?: string;
  emailSubject?: string;
  emailHtml?: string;
  emailText?: string;
}

export interface NotificationQuery {
  page?: number;
  pageSize?: number;
  isRead?: boolean;
  type?: NotificationType;
  channel?: NotificationChannel;
}

export interface PaginatedNotifications {
  data: Notification[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  unreadCount: number;
}

export interface UpdatePreferencesDto {
  emailEnabled?: boolean;
  inAppEnabled?: boolean;
  documentUpdates?: boolean;
  projectUpdates?: boolean;
  teamUpdates?: boolean;
  aiCompletions?: boolean;
  exportsCompleted?: boolean;
}
