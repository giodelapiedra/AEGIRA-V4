// MissedCheckIn Repository - Database Access
import type { PrismaClient, MissedCheckIn, MissedCheckInStatus, Prisma } from '@prisma/client';
import { BaseRepository } from '../../shared/base.repository';
import { calculateSkip, paginate } from '../../shared/utils';
import type { PaginationParams, PaginatedResponse } from '../../types/api.types';

export interface CreateMissedCheckInData {
  personId: string;
  teamId: string;
  missedDate: Date;
  scheduleWindow: string;
}

export interface MissedCheckInFilters extends PaginationParams {
  status?: MissedCheckInStatus;
  teamIds?: string[];
  personId?: string;
}

type MissedCheckInWithRelations = MissedCheckIn & {
  person: { id: string; first_name: string; last_name: string; email: string };
  team: { id: string; name: string };
};

export class MissedCheckInRepository extends BaseRepository {
  constructor(prisma: PrismaClient, companyId: string) {
    super(prisma, companyId);
  }

  /**
   * Bulk insert missed check-in records.
   * Uses skipDuplicates (ON CONFLICT DO NOTHING) for idempotency.
   */
  async createMany(records: CreateMissedCheckInData[]): Promise<number> {
    if (records.length === 0) return 0;

    const result = await this.prisma.missedCheckIn.createMany({
      data: records.map((r) => ({
        company_id: this.companyId,
        person_id: r.personId,
        team_id: r.teamId,
        missed_date: r.missedDate,
        schedule_window: r.scheduleWindow,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  /**
   * Find missed check-ins with pagination and optional filters.
   */
  async findByFilters(
    filters: MissedCheckInFilters
  ): Promise<PaginatedResponse<MissedCheckInWithRelations>> {
    const where: Prisma.MissedCheckInWhereInput = {
      company_id: this.companyId,
      ...(filters.status && { status: filters.status }),
      ...(filters.teamIds && filters.teamIds.length > 0 && { team_id: { in: filters.teamIds } }),
      ...(filters.personId && { person_id: filters.personId }),
    };

    const [items, total] = await Promise.all([
      this.prisma.missedCheckIn.findMany({
        where,
        include: {
          person: {
            select: { id: true, first_name: true, last_name: true, email: true },
          },
          team: {
            select: { id: true, name: true },
          },
        },
        orderBy: { missed_date: 'desc' },
        skip: calculateSkip(filters),
        take: filters.limit,
      }),
      this.prisma.missedCheckIn.count({ where }),
    ]);

    return paginate(items as MissedCheckInWithRelations[], total, filters);
  }

  /**
   * Count records grouped by status, optionally filtered by team.
   */
  async countByStatus(teamIds?: string[]): Promise<Record<string, number>> {
    const where: Prisma.MissedCheckInWhereInput = {
      company_id: this.companyId,
      ...(teamIds && teamIds.length > 0 && { team_id: { in: teamIds } }),
    };

    const counts = await this.prisma.missedCheckIn.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    const result: Record<string, number> = {
      OPEN: 0,
      INVESTIGATING: 0,
      EXCUSED: 0,
      RESOLVED: 0,
    };

    for (const c of counts) {
      result[c.status] = c._count;
    }

    return result;
  }

  async findById(id: string): Promise<MissedCheckIn | null> {
    return this.prisma.missedCheckIn.findFirst({
      where: this.where({ id }),
    });
  }

  async updateStatus(
    id: string,
    status: MissedCheckInStatus,
    data: { notes?: string; resolvedBy?: string }
  ): Promise<MissedCheckIn> {
    const isTerminal = status === 'EXCUSED' || status === 'RESOLVED';

    return this.prisma.missedCheckIn.update({
      where: {
        id,
        company_id: this.companyId, // ✅ CRITICAL: Scope by company_id for multi-tenant security
      },
      data: {
        status,
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(isTerminal && data.resolvedBy && {
          resolved_by: data.resolvedBy,
          resolved_at: new Date(),
        }),
      },
    });
  }

  /**
   * Find which person_ids already have a MissedCheckIn for a given date.
   * Used by the cron to avoid creating duplicate notifications.
   */
  async findExistingForDate(date: Date, personIds: string[]): Promise<Set<string>> {
    if (personIds.length === 0) return new Set();

    const existing = await this.prisma.missedCheckIn.findMany({
      where: {
        company_id: this.companyId,
        missed_date: date,
        person_id: { in: personIds },
      },
      select: { person_id: true },
    });

    return new Set(existing.map((r) => r.person_id));
  }
}
