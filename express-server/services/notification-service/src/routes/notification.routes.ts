import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';

const router = Router();

// Notification CRUD
router.get('/', (req, res, next) => notificationController.getNotifications(req, res, next));
router.post('/', (req, res, next) => notificationController.createNotification(req, res, next));
router.get('/unread-count', (req, res, next) => notificationController.getUnreadCount(req, res, next));
router.put('/mark-all-read', (req, res, next) => notificationController.markAllAsRead(req, res, next));
router.get('/:id', (req, res, next) => notificationController.getNotificationById(req, res, next));
router.put('/:id/read', (req, res, next) => notificationController.markAsRead(req, res, next));
router.delete('/:id', (req, res, next) => notificationController.deleteNotification(req, res, next));

// Preferences
router.get('/preferences/me', (req, res, next) => notificationController.getPreferences(req, res, next));
router.put('/preferences/me', (req, res, next) => notificationController.updatePreferences(req, res, next));

export { router as notificationRouter };
