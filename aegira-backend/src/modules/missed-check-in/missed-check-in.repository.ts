// MissedCheckIn Repository - Database Access
import type { PrismaClient, MissedCheckIn, Prisma, Role } from '@prisma/client';
import { BaseRepository } from '../../shared/base.repository';
import { calculateSkip, paginate } from '../../shared/utils';
import type { PaginationParams, PaginatedResponse } from '../../types/api.types';

export interface CreateMissedCheckInData {
  personId: string;
  teamId: string;
  missedDate: Date;
  scheduleWindow: string;
  // State snapshot fields (optional for backward compatibility)
  workerRoleAtMiss?: Role | null;
  teamLeaderIdAtMiss?: string | null;
  teamLeaderNameAtMiss?: string | null;
  dayOfWeek?: number;
  weekOfMonth?: number;
  daysSinceLastCheckIn?: number | null;
  daysSinceLastMiss?: number | null;
  checkInStreakBefore?: number;
  recentReadinessAvg?: number | null;
  missesInLast30d?: number;
  missesInLast60d?: number;
  missesInLast90d?: number;
  baselineCompletionRate?: number;
  isFirstMissIn30d?: boolean;
  isIncreasingFrequency?: boolean;
  reminderSent?: boolean;
  reminderFailed?: boolean;
}

export interface MissedCheckInFilters extends PaginationParams {
  teamIds?: string[];
  personId?: string;
  resolved?: boolean; // true = resolved only, false = unresolved only, undefined = all
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
   * Includes state snapshot fields for analytics when provided.
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
        // State snapshot fields
        worker_role_at_miss: r.workerRoleAtMiss ?? null,
        team_leader_id_at_miss: r.teamLeaderIdAtMiss ?? null,
        team_leader_name_at_miss: r.teamLeaderNameAtMiss ?? null,
        day_of_week: r.dayOfWeek ?? null,
        week_of_month: r.weekOfMonth ?? null,
        days_since_last_check_in: r.daysSinceLastCheckIn ?? null,
        days_since_last_miss: r.daysSinceLastMiss ?? null,
        check_in_streak_before: r.checkInStreakBefore ?? null,
        recent_readiness_avg: r.recentReadinessAvg ?? null,
        misses_in_last_30d: r.missesInLast30d ?? null,
        misses_in_last_60d: r.missesInLast60d ?? null,
        misses_in_last_90d: r.missesInLast90d ?? null,
        baseline_completion_rate: r.baselineCompletionRate ?? null,
        is_first_miss_in_30d: r.isFirstMissIn30d ?? null,
        is_increasing_frequency: r.isIncreasingFrequency ?? null,
        reminder_sent: r.reminderSent ?? true,
        reminder_failed: r.reminderFailed ?? false,
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
      ...(filters.teamIds && filters.teamIds.length > 0 && { team_id: { in: filters.teamIds } }),
      ...(filters.personId && { person_id: filters.personId }),
      ...(filters.resolved === true && { resolved_at: { not: null } }),
      ...(filters.resolved === false && { resolved_at: null }),
    };

    const [items, total] = await Promise.all([
      this.prisma.missedCheckIn.findMany({
        where,
        select: {
          id: true,
          person_id: true,
          team_id: true,
          missed_date: true,
          schedule_window: true,
          created_at: true,
          // Snapshot fields used by controller transform
          team_leader_id_at_miss: true,
          team_leader_name_at_miss: true,
          day_of_week: true,
          check_in_streak_before: true,
          recent_readiness_avg: true,
          days_since_last_check_in: true,
          days_since_last_miss: true,
          misses_in_last_30d: true,
          misses_in_last_60d: true,
          misses_in_last_90d: true,
          baseline_completion_rate: true,
          is_first_miss_in_30d: true,
          is_increasing_frequency: true,
          // Resolution tracking
          resolved_by_check_in_id: true,
          resolved_at: true,
          // Relations (selective)
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
