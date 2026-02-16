// MissedCheckIn Snapshot Service - State Calculation for Analytics
// Calculates contextual state snapshot when a missed check-in is detected
import type { PrismaClient, Role } from '@prisma/client';
import { DateTime } from 'luxon';
import {
  formatDateInTimezone,
  precomputeDateRange,
  buildDateLookup,
  daysBetweenDateStrings,
} from '../../shared/utils';
import { getEffectiveSchedule } from '../../shared/schedule.utils';
import type { PrecomputedDate } from '../../shared/utils';

/**
 * State snapshot captured at the moment a missed check-in is detected.
 * This data is immutable - preserves the worker's state for analytics.
 */
export interface StateSnapshot {
  workerRoleAtMiss: Role | null;
  dayOfWeek: number;
  weekOfMonth: number;
  daysSinceLastCheckIn: number | null;
  daysSinceLastMiss: number | null;
  checkInStreakBefore: number;
  recentReadinessAvg: number | null;
  missesInLast30d: number;
  missesInLast60d: number;
  missesInLast90d: number;
  baselineCompletionRate: number;
  isFirstMissIn30d: boolean;
  isIncreasingFrequency: boolean;
}

/**
 * Worker context needed for snapshot calculation.
 * Includes worker schedule override fields with team fallback.
 */
export interface WorkerContext {
  personId: string;
  teamId: string;
  role: Role;
  teamAssignedAt: Date | null;
  // Worker schedule override (optional)
  workDays?: string | null;
  checkInStart?: string | null;
  checkInEnd?: string | null;
  // Team schedule (for fallback)
  team: {
    work_days: string;
    check_in_start: string;
    check_in_end: string;
  };
}

interface CheckInRecord {
  date: string; // YYYY-MM-DD
  readinessScore: number;
}

interface MissedRecord {
  date: string; // YYYY-MM-DD
}

/**
 * Service for calculating state snapshots for missed check-ins.
 * Uses batch queries to efficiently process multiple workers.
 */
export class MissedCheckInSnapshotService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly companyId: string,
    private readonly timezone: string
  ) {}

  /**
   * Calculate state snapshots for multiple workers in batch.
   * Uses batched queries to avoid N+1 problem.
   */
  async calculateBatch(
    workers: WorkerContext[],
    missedDate: Date,
    holidayDates: Set<string>
  ): Promise<Map<string, StateSnapshot>> {
    if (workers.length === 0) {
      return new Map();
    }

    const personIds = workers.map((w) => w.personId);

    // Parallel batch queries for all workers
    const [checkInsMap, missedCheckInsMap] = await Promise.all([
      this.getCheckInsLast90Days(personIds, missedDate),
      this.getMissedCheckInsLast90Days(personIds, missedDate),
    ]);

    // Pre-compute 90-day date range ONCE for all workers (shared across streak + completion calculations)
    const ninetyDaysAgo = new Date(missedDate.getTime() - 90 * 24 * 60 * 60 * 1000);
    const dateRange90d = precomputeDateRange(ninetyDaysAgo, 90, this.timezone);

    const results = new Map<string, StateSnapshot>();

    for (const worker of workers) {
      const workerCheckIns = checkInsMap.get(worker.personId) || [];
      const workerMisses = missedCheckInsMap.get(worker.personId) || [];

      results.set(
        worker.personId,
        this.calculateForWorker(worker, workerCheckIns, workerMisses, missedDate, holidayDates, dateRange90d)
      );
    }

    return results;
  }

  /**
   * Calculate state snapshot for a single worker.
   */
  private calculateForWorker(
    worker: WorkerContext,
    checkIns: CheckInRecord[],
    previousMisses: MissedRecord[],
    missedDate: Date,
    holidayDates: Set<string>,
    dateRange90d: PrecomputedDate[]
  ): StateSnapshot {
    const today = formatDateInTimezone(missedDate, this.timezone);
    const todayDt = DateTime.fromISO(today, { zone: this.timezone });

    // Get effective schedule (worker override OR team default)
    const schedule = getEffectiveSchedule(
      {
        work_days: worker.workDays,
        check_in_start: worker.checkInStart,
        check_in_end: worker.checkInEnd,
      },
      worker.team
    );

    // Day of week (0=Sun, 6=Sat)
    const dayOfWeek = todayDt.weekday === 7 ? 0 : todayDt.weekday;

    // Week of month (1-5)
    const weekOfMonth = Math.ceil(todayDt.day / 7);

    // Days since last check-in (uses simple string math instead of Luxon)
    const lastCheckIn = checkIns[0]; // Sorted desc by date
    const daysSinceLastCheckIn = lastCheckIn ? daysBetweenDateStrings(lastCheckIn.date, today) : null;

    // Days since last miss
    const lastMiss = previousMisses[0]; // Sorted desc by date
    const daysSinceLastMiss = lastMiss ? daysBetweenDateStrings(lastMiss.date, today) : null;

    // Calculate streak using pre-computed date range
    const checkInStreakBefore = this.calculateStreak(
      checkIns,
      schedule.workDays,
      holidayDates,
      dateRange90d,
      today
    );

    // Recent readiness avg (last 7 days) — uses string comparison instead of daysBetween()
    const sevenDaysAgoStr = dateRange90d.length >= 7
      ? dateRange90d[dateRange90d.length - 7]!.dateStr
      : dateRange90d[0]?.dateStr ?? today;
    const last7DaysCheckIns = checkIns.filter((c) => c.date >= sevenDaysAgoStr);
    const recentReadinessAvg =
      last7DaysCheckIns.length > 0
        ? last7DaysCheckIns.reduce((sum, c) => sum + c.readinessScore, 0) /
          last7DaysCheckIns.length
        : null;

    // Count misses in windows — uses string comparison instead of daysBetween()
    const thirtyDaysAgoStr = dateRange90d.length >= 30
      ? dateRange90d[dateRange90d.length - 30]!.dateStr
      : dateRange90d[0]?.dateStr ?? today;
    const sixtyDaysAgoStr = dateRange90d.length >= 60
      ? dateRange90d[dateRange90d.length - 60]!.dateStr
      : dateRange90d[0]?.dateStr ?? today;

    const missesInLast30d = previousMisses.filter((m) => m.date >= thirtyDaysAgoStr).length;
    const missesInLast60d = previousMisses.filter((m) => m.date >= sixtyDaysAgoStr).length;
    const missesInLast90d = previousMisses.length;

    // Baseline completion rate since assignment (uses pre-computed date range)
    const baselineCompletionRate = this.calculateCompletionRate(
      worker,
      schedule.workDays,
      checkIns,
      holidayDates,
      dateRange90d,
      today
    );

    // Pattern indicators
    const isFirstMissIn30d = missesInLast30d === 0;

    // Increasing frequency: compare recent vs older periods
    // If 30d rate > 60d rate (normalized), pattern is increasing
    const rate30d = missesInLast30d / 30;
    const rate60d = missesInLast60d / 60;
    const isIncreasingFrequency = rate30d > rate60d && missesInLast30d >= 2;

    return {
      workerRoleAtMiss: worker.role,
      dayOfWeek,
      weekOfMonth,
      daysSinceLastCheckIn,
      daysSinceLastMiss,
      checkInStreakBefore,
      recentReadinessAvg: recentReadinessAvg
        ? Math.round(recentReadinessAvg * 10) / 10
        : null,
      missesInLast30d,
      missesInLast60d,
      missesInLast90d,
      baselineCompletionRate: Math.round(baselineCompletionRate * 10) / 10,
      isFirstMissIn30d,
      isIncreasingFrequency,
    };
  }

  /**
   * Calculate consecutive work day streak before the missed date.
   * Uses pre-computed date range to avoid per-iteration Luxon calls.
   *
   * The streak counts consecutive work days WITH check-ins going backwards from yesterday.
   * If the most recent work day has no check-in, streak is 0.
   */
  private calculateStreak(
    checkIns: CheckInRecord[],
    workDays: string[],
    holidayDates: Set<string>,
    dateRange90d: PrecomputedDate[],
    todayStr: string
  ): number {
    // Build a set of check-in dates for quick lookup
    const checkInDates = new Set(checkIns.map((c) => c.date));

    let streak = 0;

    // Iterate backwards from the end of pre-computed range (yesterday, day before, etc.)
    // dateRange90d is ordered from oldest to newest
    for (let i = dateRange90d.length - 1; i >= 0; i--) {
      const day = dateRange90d[i]!;
      // Skip today and future dates
      if (day.dateStr >= todayStr) continue;

      const isHolidayDay = holidayDates.has(day.dateStr);
      const isScheduledWorkDay = workDays.includes(day.dow);

      // Skip holidays and non-work days (they don't break or contribute to streak)
      if (isHolidayDay || !isScheduledWorkDay) {
        continue;
      }

      // This is a required work day
      if (checkInDates.has(day.dateStr)) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Calculate completion rate since team assignment.
   * Uses pre-computed date range to avoid per-day Luxon calls.
   * Formula: (check-ins / required work days) * 100
   */
  private calculateCompletionRate(
    worker: WorkerContext,
    workDays: string[],
    checkIns: CheckInRecord[],
    holidayDates: Set<string>,
    dateRange90d: PrecomputedDate[],
    todayStr: string
  ): number {
    if (!worker.teamAssignedAt) {
      return 0;
    }

    const assignedDateStr = formatDateInTimezone(worker.teamAssignedAt, this.timezone);

    // Count required work days from assignment to yesterday using pre-computed range
    let requiredDays = 0;
    for (const day of dateRange90d) {
      // Skip days before assignment or today onwards
      if (day.dateStr < assignedDateStr || day.dateStr >= todayStr) continue;

      if (workDays.includes(day.dow) && !holidayDates.has(day.dateStr)) {
        requiredDays++;
      }
    }

    if (requiredDays === 0) {
      return 100; // No days required yet = 100% completion
    }

    // Count check-ins since assignment (excluding today)
    const checkInsCount = checkIns.filter((c) => {
      return c.date >= assignedDateStr && c.date < todayStr;
    }).length;

    return (checkInsCount / requiredDays) * 100;
  }

  /**
   * Batch query: Get check-ins for multiple workers in last 90 days.
   */
  private async getCheckInsLast90Days(
    personIds: string[],
    referenceDate: Date
  ): Promise<Map<string, CheckInRecord[]>> {
    const ninetyDaysAgo = new Date(referenceDate.getTime() - 90 * 24 * 60 * 60 * 1000);

    const checkIns = await this.prisma.checkIn.findMany({
      where: {
        company_id: this.companyId,
        person_id: { in: personIds },
        check_in_date: {
          gte: ninetyDaysAgo,
          lt: referenceDate,
        },
      },
      select: {
        person_id: true,
        check_in_date: true,
        readiness_score: true,
      },
      orderBy: { check_in_date: 'desc' },
    });

    // Pre-compute date lookup for all unique check-in dates (one Luxon call per unique date)
    const uniqueDates = [...new Set(checkIns.map(ci => ci.check_in_date.getTime()))].map(t => new Date(t));
    const dateLookup = buildDateLookup(uniqueDates, this.timezone);

    // Group by person_id
    const result = new Map<string, CheckInRecord[]>();
    for (const personId of personIds) {
      result.set(personId, []);
    }

    for (const ci of checkIns) {
      const records = result.get(ci.person_id);
      if (records) {
        records.push({
          date: dateLookup.get(ci.check_in_date.getTime()) ?? formatDateInTimezone(ci.check_in_date, this.timezone),
          readinessScore: ci.readiness_score,
        });
      }
    }

    return result;
  }

  /**
   * Batch query: Get missed check-ins for multiple workers in last 90 days.
   */
  private async getMissedCheckInsLast90Days(
    personIds: string[],
    referenceDate: Date
  ): Promise<Map<string, MissedRecord[]>> {
    const ninetyDaysAgo = new Date(referenceDate.getTime() - 90 * 24 * 60 * 60 * 1000);

    const misses = await this.prisma.missedCheckIn.findMany({
      where: {
        company_id: this.companyId,
        person_id: { in: personIds },
        missed_date: {
          gte: ninetyDaysAgo,
          lt: referenceDate,
        },
      },
      select: {
        person_id: true,
        missed_date: true,
      },
      orderBy: { missed_date: 'desc' },
    });

    // Pre-compute date lookup for all unique missed dates
    const uniqueDates = [...new Set(misses.map(m => m.missed_date.getTime()))].map(t => new Date(t));
    const dateLookup = buildDateLookup(uniqueDates, this.timezone);

    // Group by person_id
    const result = new Map<string, MissedRecord[]>();
    for (const personId of personIds) {
      result.set(personId, []);
    }

    for (const miss of misses) {
      const records = result.get(miss.person_id);
      if (records) {
        records.push({
          date: dateLookup.get(miss.missed_date.getTime()) ?? formatDateInTimezone(miss.missed_date, this.timezone),
        });
      }
    }

    return result;
  }
}
