// Notification Repository - Database Access
import type { PrismaClient, Notification, Prisma, NotificationType } from '@prisma/client';
import { BaseRepository } from '../../shared/base.repository';
import { calculateSkip, paginate } from '../../shared/utils';
import type { PaginationParams, PaginatedResponse } from '../../types/api.types';

export interface CreateNotificationData {
  personId: string;
  type: NotificationType;
  title: string;
  message: string;
}

export class NotificationRepository extends BaseRepository {
  constructor(prisma: PrismaClient, companyId: string) {
    super(prisma, companyId);
  }

  async create(data: CreateNotificationData): Promise<Notification> {
    return this.prisma.notification.create({
      data: {
        company_id: this.companyId,
        person_id: data.personId,
        type: data.type,
        title: data.title,
        message: data.message,
      },
    });
  }

  async createMany(notifications: CreateNotificationData[]): Promise<number> {
    const result = await this.prisma.notification.createMany({
      data: notifications.map((n) => ({
        company_id: this.companyId,
        person_id: n.personId,
        type: n.type,
        title: n.title,
        message: n.message,
      })),
    });
    return result.count;
  }

  async findById(id: string): Promise<Notification | null> {
    return this.prisma.notification.findFirst({
      where: this.where({ id }),
    });
  }

  async findByPerson(
    personId: string,
    params: PaginationParams & { filter?: 'unread' | 'read' }
  ): Promise<PaginatedResponse<Notification>> {
    const where: Prisma.NotificationWhereInput = {
      company_id: this.companyId,
      person_id: personId,
      ...(params.filter === 'unread' && { read_at: null }),
      ...(params.filter === 'read' && { read_at: { not: null } }),
    };

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: calculateSkip(params),
        take: params.limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return paginate(items, total, params);
  }

  async countUnread(personId: string): Promise<number> {
    return this.prisma.notification.count({
      where: this.where({
        person_id: personId,
        read_at: null,
      }),
    });
  }

  async markAsRead(id: string, personId: string): Promise<Notification | null> {
    const result = await this.prisma.notification.updateMany({
      where: {
        id,
        person_id: personId,
        company_id: this.companyId,
        read_at: null, // Only update if not already read
      },
      data: { read_at: new Date() },
    });

    if (result.count === 0) return null;

    return this.prisma.notification.findFirst({ where: this.where({ id }) });
  }

  async markAllAsRead(personId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: this.where({
        person_id: personId,
        read_at: null,
      }),
      data: { read_at: new Date() },
    });
    return result.count;
  }

  async deleteOld(daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.prisma.notification.deleteMany({
      where: {
        company_id: this.companyId,
        created_at: { lt: cutoffDate },
        read_at: { not: null },
      },
    });
    return result.count;
  }
}
