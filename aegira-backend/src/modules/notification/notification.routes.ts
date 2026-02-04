// Notification Module Routes
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import * as controller from './notification.controller';
import { listNotificationsQuerySchema, notificationIdParamSchema } from './notification.validator';

const router = new Hono();

router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

// GET /api/v1/notifications - List notifications (paginated)
router.get('/', zValidator('query', listNotificationsQuerySchema), controller.listNotifications);

// GET /api/v1/notifications/unread - Get unread count
router.get('/unread', controller.getUnreadCount);

// PATCH /api/v1/notifications/mark-all-read - Mark all as read (MUST be before /:id)
router.patch('/mark-all-read', controller.markAllAsRead);

// PATCH /api/v1/notifications/:id/read - Mark as read
router.patch('/:id/read', zValidator('param', notificationIdParamSchema), controller.markAsRead);

export { router as notificationRoutes };
