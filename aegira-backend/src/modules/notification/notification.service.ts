// Notification Service - Business Logic
import { NotificationRepository, CreateNotificationData } from './notification.repository';
import { AppError } from '../../shared/errors';
import type { Notification, NotificationType } from '@prisma/client';
import type { PaginationParams, PaginatedResponse } from '../../types/api.types';

interface CreateNotificationInput {
  personId: string;
  type: NotificationType;
  title: string;
  message: string;
}

export class NotificationService {
  constructor(private readonly repository: NotificationRepository) {}

  async list(
    personId: string,
    params: PaginationParams & { filter?: 'unread' | 'read' }
  ): Promise<PaginatedResponse<Notification>> {
    return this.repository.findByPerson(personId, params);
  }

  async create(input: CreateNotificationInput): Promise<Notification> {
    return this.repository.create({
      personId: input.personId,
      type: input.type,
      title: input.title,
      message: input.message,
    });
  }

  async createMany(notifications: CreateNotificationInput[]): Promise<number> {
    return this.repository.createMany(
      notifications.map((n) => ({
        personId: n.personId,
        type: n.type,
        title: n.title,
        message: n.message,
      }))
    );
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
    // Single query: updateMany with ownership + read_at null guard
    const updated = await this.repository.markAsRead(id, personId);

    if (updated) return updated;

    // updateMany returned 0 rows — either not found, wrong owner, or already read.
    // Distinguish between "already read" and "not found / not yours".
    const existing = await this.repository.findById(id);
    if (existing && existing.person_id === personId) {
      // Already read — return as-is (idempotent)
      return existing;
    }

    throw new AppError('NOT_FOUND', 'Notification not found', 404);
  }

  async markAllAsRead(personId: string): Promise<number> {
    return this.repository.markAllAsRead(personId);
  }

  // Helper methods for common notification types
  async sendCheckInReminder(personId: string): Promise<Notification> {
    return this.create({
      personId,
      type: 'CHECK_IN_REMINDER',
      title: 'Check-in Reminder',
      message: "Don't forget to complete your daily check-in!",
    });
  }

  async sendMissedCheckInAlert(personId: string, date: string): Promise<Notification> {
    return this.create({
      personId,
      type: 'MISSED_CHECK_IN',
      title: 'Missed Check-in',
      message: `You missed your check-in for ${date}. Please contact your team lead if needed.`,
    });
  }

  async sendTeamAlert(personId: string, title: string, message: string): Promise<Notification> {
    return this.create({
      personId,
      type: 'TEAM_ALERT',
      title,
      message,
    });
  }

  async sendSystemNotification(personId: string, title: string, message: string): Promise<Notification> {
    return this.create({
      personId,
      type: 'SYSTEM',
      title,
      message,
    });
  }
}
