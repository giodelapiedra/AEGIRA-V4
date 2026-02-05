// MissedCheckIn Snapshot Service - State Calculation for Analytics
// Calculates contextual state snapshot when a missed check-in is detected
import type { PrismaClient, Role } from '@prisma/client';
import { DateTime } from 'luxon';
import { formatDateInTimezone, getDayOfWeekInTimezone } from '../../shared/utils';

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
 */
export interface WorkerContext {
  personId: string;
  teamId: string;
  role: Role;
  teamAssignedAt: Date | null;
  workDays: string[];
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

    const results = new Map<string, StateSnapshot>();

    for (const worker of workers) {
      const workerCheckIns = checkInsMap.get(worker.personId) || [];
      const workerMisses = missedCheckInsMap.get(worker.personId) || [];

      results.set(
        worker.personId,
        this.calculateForWorker(worker, workerCheckIns, workerMisses, missedDate, holidayDates)
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
    holidayDates: Set<string>
  ): StateSnapshot {
    const today = formatDateInTimezone(missedDate, this.timezone);
    const todayDt = DateTime.fromISO(today, { zone: this.timezone });

    // Day of week (0=Sun, 6=Sat)
    const dayOfWeek = todayDt.weekday === 7 ? 0 : todayDt.weekday;

    // Week of month (1-5)
    const weekOfMonth = Math.ceil(todayDt.day / 7);

    // Days since last check-in
    const lastCheckIn = checkIns[0]; // Sorted desc by date
    const daysSinceLastCheckIn = lastCheckIn ? this.daysBetween(lastCheckIn.date, today) : null;

    // Days since last miss
    const lastMiss = previousMisses[0]; // Sorted desc by date
    const daysSinceLastMiss = lastMiss ? this.daysBetween(lastMiss.date, today) : null;

    // Calculate streak (consecutive work days with check-ins before today)
    const checkInStreakBefore = this.calculateStreak(
      checkIns,
      worker.workDays,
      holidayDates,
      missedDate
    );

    // Recent readiness avg (last 7 days)
    const last7DaysCheckIns = checkIns.filter((c) => this.daysBetween(c.date, today) <= 7);
    const recentReadinessAvg =
      last7DaysCheckIns.length > 0
        ? last7DaysCheckIns.reduce((sum, c) => sum + c.readinessScore, 0) /
          last7DaysCheckIns.length
        : null;

    // Count misses in windows (excluding today's miss which is being created)
    const missesInLast30d = previousMisses.filter(
      (m) => this.daysBetween(m.date, today) <= 30
    ).length;
    const missesInLast60d = previousMisses.filter(
      (m) => this.daysBetween(m.date, today) <= 60
    ).length;
    const missesInLast90d = previousMisses.length;

    // Baseline completion rate since assignment
    const baselineCompletionRate = this.calculateCompletionRate(
      worker,
      checkIns,
      holidayDates,
      missedDate
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
   * Holidays and non-work days are skipped (don't break streak).
   *
   * The streak counts consecutive work days WITH check-ins going backwards from yesterday.
   * If the most recent work day has no check-in, streak is 0.
   */
  private calculateStreak(
    checkIns: CheckInRecord[],
    workDays: string[],
    holidayDates: Set<string>,
    missedDate: Date
  ): number {
    // Build a set of check-in dates for quick lookup
    const checkInDates = new Set(checkIns.map((c) => c.date));

    let streak = 0;

    // Iterate backwards from yesterday (not today - today is the missed day)
    for (let i = 1; i <= 90; i++) {
      const checkDate = new Date(missedDate.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = formatDateInTimezone(checkDate, this.timezone);
      const dow = getDayOfWeekInTimezone(this.timezone, dateStr).toString();
      const isHolidayDay = holidayDates.has(dateStr);
      const isScheduledWorkDay = workDays.includes(dow);

      // Skip holidays and non-work days (they don't break or contribute to streak)
      if (isHolidayDay || !isScheduledWorkDay) {
        continue;
      }

      // This is a required work day
      if (checkInDates.has(dateStr)) {
        // Worker checked in on this work day - increment streak
        streak++;
      } else {
        // Worker missed this work day - streak ends here
        // (If streak is still 0, this confirms the most recent work day was missed)
        break;
      }
    }

    return streak;
  }

  /**
   * Calculate completion rate since team assignment.
   * Formula: (check-ins / required work days) * 100
   */
  private calculateCompletionRate(
    worker: WorkerContext,
    checkIns: CheckInRecord[],
    holidayDates: Set<string>,
    missedDate: Date
  ): number {
    if (!worker.teamAssignedAt) {
      return 0;
    }

    const assignedDateStr = formatDateInTimezone(worker.teamAssignedAt, this.timezone);
    const todayStr = formatDateInTimezone(missedDate, this.timezone);

    // Count required work days from assignment to yesterday (not including today)
    let requiredDays = 0;
    const startDate = new Date(worker.teamAssignedAt);
    const yesterday = new Date(missedDate.getTime() - 24 * 60 * 60 * 1000);

    for (
      let d = new Date(startDate);
      d <= yesterday;
      d = new Date(d.getTime() + 24 * 60 * 60 * 1000)
    ) {
      const dateStr = formatDateInTimezone(d, this.timezone);
      const dow = getDayOfWeekInTimezone(this.timezone, dateStr).toString();

      if (worker.workDays.includes(dow) && !holidayDates.has(dateStr)) {
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
   * Calculate days between two date strings (YYYY-MM-DD).
   */
  private daysBetween(dateStr1: string, dateStr2: string): number {
    const dt1 = DateTime.fromISO(dateStr1, { zone: this.timezone });
    const dt2 = DateTime.fromISO(dateStr2, { zone: this.timezone });
    return Math.abs(Math.floor(dt2.diff(dt1, 'days').days));
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

    // Group by person_id
    const result = new Map<string, CheckInRecord[]>();
    for (const personId of personIds) {
      result.set(personId, []);
    }

    for (const ci of checkIns) {
      const records = result.get(ci.person_id);
      if (records) {
        records.push({
          date: formatDateInTimezone(ci.check_in_date, this.timezone),
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

    // Group by person_id
    const result = new Map<string, MissedRecord[]>();
    for (const personId of personIds) {
      result.set(personId, []);
    }

    for (const miss of misses) {
      const records = result.get(miss.person_id);
      if (records) {
        records.push({
          date: formatDateInTimezone(miss.missed_date, this.timezone),
        });
      }
    }

    return result;
  }
}
