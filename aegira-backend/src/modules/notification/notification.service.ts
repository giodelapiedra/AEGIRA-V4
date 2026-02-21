// Notification Service - Business Logic + Fire-and-Forget Utilities
import type { PrismaClient, Notification } from '@prisma/client';
import { NotificationRepository, type CreateNotificationData, type NotificationFilter } from './notification.repository';
import { AppError } from '../../shared/errors';
import { logger } from '../../config/logger';
import type { PaginationParams, PaginatedResponse } from '../../types/api.types';

// Re-export for convenience — external callers import from here, not the repository
export type { CreateNotificationData } from './notification.repository';

// ─── Service (used by notification controller for read-side operations) ────

export class NotificationService {
  constructor(private readonly repository: NotificationRepository) {}

  async list(
    personId: string,
    params: PaginationParams & { filter?: NotificationFilter }
  ): Promise<PaginatedResponse<Notification>> {
    return this.repository.findByPerson(personId, params);
  }

  async getUnreadCount(personId: string): Promise<number> {
    return this.repository.countUnread(personId);
  }

  /**
   * Marks a notification as read.
   * Verifies ownership (person_id + company_id) at the database level.
   * Returns the notification if newly marked, or the existing one if already read.
   * Throws NOT_FOUND if the notification doesn't exist or doesn't belong to the user.
   */
  async markAsRead(id: string, personId: string): Promise<Notification> {
    const updated = await this.repository.markAsRead(id, personId);

    if (updated) return updated;

    // updateMany returned 0 rows — either not found, wrong owner, or already read.
    const existing = await this.repository.findById(id);
    if (existing && existing.person_id === personId) {
      return existing;
    }

    throw new AppError('NOT_FOUND', 'Notification not found', 404);
  }

  async markAllAsRead(personId: string): Promise<number> {
    return this.repository.markAllAsRead(personId);
  }

  /**
   * Archives a notification.
   * Same ownership pattern as markAsRead — verifies person_id + company_id at DB level.
   * Returns the notification if newly archived, or the existing one if already archived.
   * Throws NOT_FOUND if the notification doesn't exist or doesn't belong to the user.
   */
  async archive(id: string, personId: string): Promise<Notification> {
    const updated = await this.repository.archive(id, personId);

    if (updated) return updated;

    // updateMany returned 0 rows — either not found, wrong owner, or already archived.
    const existing = await this.repository.findById(id);
    if (existing && existing.person_id === personId) {
      return existing;
    }

    throw new AppError('NOT_FOUND', 'Notification not found', 404);
  }

  async archiveAllRead(personId: string): Promise<number> {
    return this.repository.archiveAllRead(personId);
  }
}

// ─── Fire-and-Forget Utilities (used by external modules) ──────────────
//
// Follows the same pattern as logAudit() in shared/audit.ts:
// errors are logged but never thrown — safe to call without await.

/**
 * Fire-and-forget: create a single notification.
 * Errors are logged but never thrown — safe to call without await.
 */
export function sendNotification(
  prisma: PrismaClient,
  companyId: string,
  data: CreateNotificationData
): void {
  const repo = new NotificationRepository(prisma, companyId);
  repo.create(data).catch((error) => {
    logger.error(
      { error, companyId, personId: data.personId, type: data.type },
      'Failed to send notification'
    );
  });
}

/**
 * Fire-and-forget: create multiple notifications in batch.
 * Errors are logged but never thrown — safe to call without await.
 */
export function sendNotifications(
  prisma: PrismaClient,
  companyId: string,
  notifications: CreateNotificationData[]
): void {
  if (notifications.length === 0) return;
  const repo = new NotificationRepository(prisma, companyId);
  repo.createMany(notifications).catch((error) => {
    logger.error(
      { error, companyId, count: notifications.length },
      'Failed to send notifications'
    );
  });
}
