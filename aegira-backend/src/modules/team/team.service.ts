// Team Service - Business Logic (Analytics)
// This service handles complex analytics queries that span multiple tables.
// It uses Prisma directly (not repositories) because analytics aggregation
// is fundamentally different from CRUD operations.
import type { PrismaClient } from '@prisma/client';
import {
  getTodayInTimezone,
  parseDateInTimezone,
  formatDateInTimezone,
  toCompanyTimezone,
  precomputeDateRange,
  buildDateLookup,
} from '../../shared/utils';
import { isWorkDay } from '../../shared/schedule.utils';

interface TeamAnalyticsResult {
  period: string;
  summary: {
    totalCheckIns: number;
    avgReadiness: number;
    workerCount: number;
    avgComplianceRate: number;
    readinessDistribution: {
      green: number;
      yellow: number;
      red: number;
    };
  };
  trends: Array<{
    date: string;
    checkIns: number;
    expectedWorkers: number;
    avgReadiness: number;
    complianceRate: number;
    submitTime: string | null;
    green: number;
    yellow: number;
    red: number;
  }>;
  records: Array<{
    name: string;
    date: string;
    readinessScore: number;
    readinessLevel: string;
    submitTime: string;
  }>;
}

export class TeamService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly companyId: string
  ) {}

  /**
   * Get team analytics with trends, compliance rates, and readiness distribution
   * Supports filtering by team(s) for role-based access control
   */
  async getTeamAnalytics(
    period: string,
    timezone: string,
    teamIds: string[] | null
  ): Promise<TeamAnalyticsResult> {
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;

    // Get team creation date to cap the analytics range (only for single team)
    let teamCreatedAt: Date | null = null;
    if (teamIds && teamIds.length === 1) {
      const team = await this.prisma.team.findFirst({
        where: { id: teamIds[0], company_id: this.companyId },
        select: { created_at: true },
      });
      teamCreatedAt = team?.created_at || null;
    }

    // Get date range in company timezone
    const todayStr = getTodayInTimezone(timezone);
    const endDate = parseDateInTimezone(todayStr, timezone);
    endDate.setHours(23, 59, 59, 999);
    let startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);

    // Cap start date to team creation date - don't show data before team existed
    if (teamCreatedAt && teamCreatedAt > startDate) {
      startDate = new Date(teamCreatedAt);
      startDate.setHours(0, 0, 0, 0);
    }

    // Build filters based on team context
    const checkInTeamFilter = teamIds ? { person: { team_id: { in: teamIds } } } : {};
    const workerTeamFilter = teamIds ? { team_id: { in: teamIds } } : {};

    // Pattern 3: DB-level aggregation over app-level
    // Split into: (1) groupBy for trends aggregation (~270 rows vs 9,000)
    //             (2) findMany take:200 for records table
    //             (3) workers for compliance
    const checkInWhere = {
      company_id: this.companyId,
      check_in_date: { gte: startDate, lte: endDate },
      ...checkInTeamFilter,
    };

    const [dailyAggregates, submitTimeData, records, workers] = await Promise.all([
      // 1. Daily aggregates by readiness level — ~270 rows for 90d (not 9,000)
      this.prisma.checkIn.groupBy({
        by: ['check_in_date', 'readiness_level'],
        where: checkInWhere,
        _count: true,
        _sum: { readiness_score: true },
      }),
      // 2. Submit time data — lightweight query (only 2 fields, no person include)
      //    Still fetches all rows but ~16 bytes/row vs ~200 bytes/row with full select
      this.prisma.checkIn.findMany({
        where: checkInWhere,
        select: { check_in_date: true, created_at: true },
      }),
      // 3. Individual records — capped at 200 for the detail table
      this.prisma.checkIn.findMany({
        where: checkInWhere,
        select: {
          check_in_date: true,
          readiness_score: true,
          readiness_level: true,
          created_at: true,
          person: { select: { first_name: true, last_name: true } },
        },
        orderBy: [{ check_in_date: 'desc' }, { created_at: 'desc' }],
        take: 200,
      }),
      // 4. Workers with assignment dates (needed for per-day compliance)
      this.prisma.person.findMany({
        where: {
          company_id: this.companyId,
          role: 'WORKER',
          is_active: true,
          ...workerTeamFilter,
        },
        select: {
          team_assigned_at: true,
          work_days: true,
          check_in_start: true,
          check_in_end: true,
          team: {
            select: {
              work_days: true,
              check_in_start: true,
              check_in_end: true,
            },
          },
        },
      }),
    ]);

    const workerCount = workers.length;

    // Build daily stats from groupBy results (single pass over ~270 rows)
    const dateLookup = buildDateLookup(
      [...new Set(dailyAggregates.map(r => r.check_in_date.getTime()))].map(t => new Date(t)),
      timezone
    );

    const dailyStats: Record<
      string,
      { count: number; totalScore: number; green: number; yellow: number; red: number }
    > = {};

    let totalCheckIns = 0;
    let totalScoreSum = 0;
    let totalGreen = 0;
    let totalYellow = 0;
    let totalRed = 0;

    for (const row of dailyAggregates) {
      const dateKey = dateLookup.get(row.check_in_date.getTime()) ?? formatDateInTimezone(row.check_in_date, timezone);
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = { count: 0, totalScore: 0, green: 0, yellow: 0, red: 0 };
      }
      const count = row._count;
      const scoreSum = row._sum.readiness_score ?? 0;

      dailyStats[dateKey].count += count;
      dailyStats[dateKey].totalScore += scoreSum;
      totalCheckIns += count;
      totalScoreSum += scoreSum;

      if (row.readiness_level === 'GREEN') {
        dailyStats[dateKey].green += count;
        totalGreen += count;
      } else if (row.readiness_level === 'YELLOW') {
        dailyStats[dateKey].yellow += count;
        totalYellow += count;
      } else {
        dailyStats[dateKey].red += count;
        totalRed += count;
      }
    }

    // Build submit time lookup from ALL check-ins (lightweight query — no person data)
    const submitTimeByDate: Record<string, number[]> = {};
    const submitDateLookup = buildDateLookup(
      [...new Set(submitTimeData.map(r => r.check_in_date.getTime()))].map(t => new Date(t)),
      timezone
    );
    for (const rec of submitTimeData) {
      const dateKey = submitDateLookup.get(rec.check_in_date.getTime()) ?? formatDateInTimezone(rec.check_in_date, timezone);
      if (!submitTimeByDate[dateKey]) submitTimeByDate[dateKey] = [];
      const submitDt = toCompanyTimezone(new Date(rec.created_at), timezone);
      submitTimeByDate[dateKey].push(submitDt.hour * 60 + submitDt.minute);
    }

    // Pre-compute date range for trends (avoids per-iteration Luxon calls)
    const actualDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const dateRange = precomputeDateRange(startDate, actualDays, timezone);

    // Finding #7: Pre-group workers by day-of-week to reduce O(days × workers) to O(days × workers_per_dow)
    // Pre-compute each worker's assignedDateStr ONCE (avoids O(days × workers) Luxon calls)
    interface WorkerEntry { assignedDateStr: string }
    const workersByDow = new Map<string, WorkerEntry[]>();

    for (const w of workers) {
      if (!w.team_assigned_at || !w.team) continue;
      const assignedDateStr = formatDateInTimezone(new Date(w.team_assigned_at), timezone);

      // Check which days of the week this worker is scheduled to work
      for (let dow = 0; dow < 7; dow++) {
        const dowStr = dow.toString();
        if (isWorkDay(dowStr, { work_days: w.work_days, check_in_start: w.check_in_start, check_in_end: w.check_in_end }, { work_days: w.team.work_days, check_in_start: w.team.check_in_start, check_in_end: w.team.check_in_end })) {
          const arr = workersByDow.get(dowStr) ?? [];
          arr.push({ assignedDateStr });
          workersByDow.set(dowStr, arr);
        }
      }
    }

    // Build trends array using pre-computed ranges
    const trends = [];
    let totalExpected = 0;

    for (const day of dateRange) {
      const { dateStr: dateKey, dow: dayOfWeek } = day;
      const stats = dailyStats[dateKey] || { count: 0, totalScore: 0, green: 0, yellow: 0, red: 0 };

      // Count workers who were assigned BEFORE this date and it's their work day.
      // Uses pre-grouped workersByDow instead of filtering all workers per day.
      const eligible = workersByDow.get(dayOfWeek) ?? [];
      const expectedWorkers = eligible.filter(w => w.assignedDateStr < dateKey).length;

      // Skip days where no workers were expected (no work day / not yet assigned)
      if (expectedWorkers === 0 && stats.count === 0) continue;

      totalExpected += expectedWorkers;

      // Calculate average submit time from records data (HH:MM format)
      let submitTime: string | null = null;
      const daySubmitMinutes = submitTimeByDate[dateKey];
      if (daySubmitMinutes && daySubmitMinutes.length > 0) {
        const avgMinutes = Math.round(
          daySubmitMinutes.reduce((a: number, b: number) => a + b, 0) / daySubmitMinutes.length
        );
        const h = Math.floor(avgMinutes / 60).toString().padStart(2, '0');
        const m = (avgMinutes % 60).toString().padStart(2, '0');
        submitTime = `${h}:${m}`;
      }

      trends.push({
        date: dateKey,
        checkIns: stats.count,
        expectedWorkers,
        avgReadiness: stats.count > 0 ? Math.round(stats.totalScore / stats.count) : 0,
        complianceRate: expectedWorkers > 0 ? Math.round((stats.count / expectedWorkers) * 100) : 0,
        submitTime,
        green: stats.green,
        yellow: stats.yellow,
        red: stats.red,
      });
    }

    // Overall stats — use counters accumulated from groupBy results above
    const avgReadiness = totalCheckIns > 0 ? Math.round(totalScoreSum / totalCheckIns) : 0;

    // Build individual check-in records with person names from the limited records query
    const recordDateLookup = buildDateLookup(
      [...new Set(records.map(r => r.check_in_date.getTime()))].map(t => new Date(t)),
      timezone
    );
    const formattedRecords = records.map((checkIn) => {
      const dateKey = recordDateLookup.get(checkIn.check_in_date.getTime()) ?? formatDateInTimezone(checkIn.check_in_date, timezone);
      const submitDt = toCompanyTimezone(new Date(checkIn.created_at), timezone);

      return {
        name: `${checkIn.person.first_name} ${checkIn.person.last_name}`,
        date: dateKey,
        readinessScore: checkIn.readiness_score,
        readinessLevel: checkIn.readiness_level,
        submitTime: submitDt.toFormat('HH:mm'),
      };
    });

    return {
      period,
      summary: {
        totalCheckIns,
        avgReadiness,
        workerCount,
        avgComplianceRate: totalExpected > 0 ? Math.round((totalCheckIns / totalExpected) * 100) : 0,
        readinessDistribution: {
          green: totalGreen,
          yellow: totalYellow,
          red: totalRed,
        },
      },
      trends,
      records: formattedRecords,
    };
  }
}
