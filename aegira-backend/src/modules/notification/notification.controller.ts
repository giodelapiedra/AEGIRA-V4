// Notification Controller - Request Handling
import type { Context } from 'hono';
import { NotificationService } from './notification.service';
import { NotificationRepository } from './notification.repository';
import { prisma } from '../../config/database';
import type { AuthenticatedUser } from '../../types/api.types';
import type { ListNotificationsQuery } from './notification.validator';

function getService(companyId: string): NotificationService {
  const repository = new NotificationRepository(prisma, companyId);
  return new NotificationService(repository);
}

export async function listNotifications(c: Context): Promise<Response> {
  const user = c.get('user') as AuthenticatedUser;
  const companyId = c.get('companyId') as string;
  const { page, limit, filter } = c.req.valid('query' as never) as ListNotificationsQuery;

  const service = getService(companyId);
  const result = await service.list(user.id, { page, limit, filter });

  return c.json({ success: true, data: result });
}

export async function getUnreadCount(c: Context): Promise<Response> {
  const user = c.get('user') as AuthenticatedUser;
  const companyId = c.get('companyId') as string;

  const service = getService(companyId);
  const count = await service.getUnreadCount(user.id);

  return c.json({ success: true, data: { count } });
}

export async function markAsRead(c: Context): Promise<Response> {
  const user = c.get('user') as AuthenticatedUser;
  const companyId = c.get('companyId') as string;
  const { id } = c.req.valid('param' as never) as { id: string };

  const service = getService(companyId);
  const result = await service.markAsRead(id, user.id);

  return c.json({ success: true, data: result });
}

export async function markAllAsRead(c: Context): Promise<Response> {
  const user = c.get('user') as AuthenticatedUser;
  const companyId = c.get('companyId') as string;

  const service = getService(companyId);
  const count = await service.markAllAsRead(user.id);

  return c.json({ success: true, data: { markedCount: count } });
}

export async function archiveNotification(c: Context): Promise<Response> {
  const user = c.get('user') as AuthenticatedUser;
  const companyId = c.get('companyId') as string;
  const { id } = c.req.valid('param' as never) as { id: string };

  const service = getService(companyId);
  const result = await service.archive(id, user.id);

  return c.json({ success: true, data: result });
}

export async function archiveAllRead(c: Context): Promise<Response> {
  const user = c.get('user') as AuthenticatedUser;
  const companyId = c.get('companyId') as string;

  const service = getService(companyId);
  const count = await service.archiveAllRead(user.id);

  return c.json({ success: true, data: { archivedCount: count } });
}
