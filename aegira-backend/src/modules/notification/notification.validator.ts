// Notification Validation Schemas
import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  filter: z.enum(['unread', 'read']).optional(),
});

export const notificationIdParamSchema = z.object({
  id: z.string().uuid('Invalid notification ID'),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
