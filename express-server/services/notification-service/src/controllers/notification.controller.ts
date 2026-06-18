import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { notificationService } from '../services/notification.service';
import { NotificationChannel, NotificationType } from '../types/notification.types';

const createNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: z.nativeEnum(NotificationType),
  title: z.string().min(1).max(255),
  message: z.string().max(2000).optional(),
  data: z.record(z.unknown()).optional(),
  channel: z.nativeEnum(NotificationChannel).optional(),
  sendEmail: z.boolean().optional(),
  emailRecipient: z.string().email().optional(),
  emailSubject: z.string().max(255).optional(),
  emailHtml: z.string().optional(),
  emailText: z.string().optional(),
});

const querySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  isRead: z
    .string()
    .optional()
    .transform((v) => {
      if (v === 'true') {return true;}
      if (v === 'false') {return false;}

      return undefined;
    }),
  type: z.nativeEnum(NotificationType).optional(),
  channel: z.nativeEnum(NotificationChannel).optional(),
});

const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  documentUpdates: z.boolean().optional(),
  projectUpdates: z.boolean().optional(),
  teamUpdates: z.boolean().optional(),
  aiCompletions: z.boolean().optional(),
  exportsCompleted: z.boolean().optional(),
});

export class NotificationController {
  async createNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createNotificationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
          success: false,
          message: 'Validation failed',
          errors: parsed.error.flatten().fieldErrors,
        });

        return;
      }

      const notification = await notificationService.createNotification(parsed.data);

      res.status(StatusCodes.CREATED).json({
        success: true,
        data: notification,
      });
    } catch (err) {
      next(err);
    }
  }

  async getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as Request & { user?: { id: string } }).user?.id;
      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });

        return;
      }

      const parsed = querySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
          success: false,
          message: 'Invalid query parameters',
          errors: parsed.error.flatten().fieldErrors,
        });

        return;
      }

      const result = await notificationService.getNotifications(userId, parsed.data);

      res.status(StatusCodes.OK).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async getNotificationById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as Request & { user?: { id: string } }).user?.id;
      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });

        return;
      }

      const { id } = req.params;
      const notifications = await notificationService.getNotifications(userId, {});
      const notification = notifications.data.find((n) => n.id === id);

      if (!notification) {
        res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Notification not found' });

        return;
      }

      res.status(StatusCodes.OK).json({ success: true, data: notification });
    } catch (err) {
      next(err);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as Request & { user?: { id: string } }).user?.id;
      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });

        return;
      }

      const { id } = req.params;
      const notification = await notificationService.markAsRead(id, userId);

      if (!notification) {
        res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Notification not found' });

        return;
      }

      res.status(StatusCodes.OK).json({ success: true, data: notification });
    } catch (err) {
      next(err);
    }
  }

  async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as Request & { user?: { id: string } }).user?.id;
      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });

        return;
      }

      const result = await notificationService.markAllAsRead(userId);

      res.status(StatusCodes.OK).json({
        success: true,
        data: result,
        message: `${result.updated} notification(s) marked as read`,
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as Request & { user?: { id: string } }).user?.id;
      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });

        return;
      }

      const { id } = req.params;
      const deleted = await notificationService.deleteNotification(id, userId);

      if (!deleted) {
        res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Notification not found' });

        return;
      }

      res.status(StatusCodes.NO_CONTENT).send();
    } catch (err) {
      next(err);
    }
  }

  async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as Request & { user?: { id: string } }).user?.id;
      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });

        return;
      }

      const result = await notificationService.getUnreadCount(userId);
      res.status(StatusCodes.OK).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as Request & { user?: { id: string } }).user?.id;
      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });

        return;
      }

      const prefs = await notificationService.getPreferences(userId);
      res.status(StatusCodes.OK).json({ success: true, data: prefs });
    } catch (err) {
      next(err);
    }
  }

  async updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as Request & { user?: { id: string } }).user?.id;
      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });

        return;
      }

      const parsed = updatePreferencesSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
          success: false,
          message: 'Validation failed',
          errors: parsed.error.flatten().fieldErrors,
        });

        return;
      }

      const prefs = await notificationService.updatePreferences(userId, parsed.data);
      res.status(StatusCodes.OK).json({ success: true, data: prefs });
    } catch (err) {
      next(err);
    }
  }
}

export const notificationController = new NotificationController();
