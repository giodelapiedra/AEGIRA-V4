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

    // Get workers with their assignment dates (needed for per-day compliance)
    const [checkIns, workers] = await Promise.all([
      this.prisma.checkIn.findMany({
        where: {
          company_id: this.companyId,
          check_in_date: { gte: startDate, lte: endDate },
          ...checkInTeamFilter,
        },
        select: {
          check_in_date: true,
          readiness_score: true,
          readiness_level: true,
          created_at: true,
          person: {
            select: {
              first_name: true,
              last_name: true,
            },
          },
        },
        orderBy: [{ check_in_date: 'desc' }, { created_at: 'desc' }],
      }),
      this.prisma.person.findMany({
        where: {
          company_id: this.companyId,
          role: 'WORKER',
          is_active: true,
          ...workerTeamFilter,
        },
        select: {
          team_assigned_at: true,
          // Worker schedule override fields
          work_days: true,
          check_in_start: true,
          check_in_end: true,
          // Team schedule for fallback
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

    // Pre-compute date lookup for check-in dates (avoids per-record Luxon calls)
    const uniqueCheckInDates = [...new Set(checkIns.map(c => c.check_in_date.getTime()))].map(t => new Date(t));
    const dateLookup = buildDateLookup(uniqueCheckInDates, timezone);

    // Calculate daily stats (including submit times for average)
    const dailyStats: Record<
      string,
      {
        count: number;
        totalScore: number;
        green: number;
        yellow: number;
        red: number;
        submitMinutes: number[];
      }
    > = {};

    for (const checkIn of checkIns) {
      const dateKey = dateLookup.get(checkIn.check_in_date.getTime()) ?? formatDateInTimezone(checkIn.check_in_date, timezone);
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = {
          count: 0,
          totalScore: 0,
          green: 0,
          yellow: 0,
          red: 0,
          submitMinutes: [],
        };
      }
      dailyStats[dateKey].count++;
      dailyStats[dateKey].totalScore += checkIn.readiness_score;
      if (checkIn.readiness_level === 'GREEN') dailyStats[dateKey].green++;
      else if (checkIn.readiness_level === 'YELLOW') dailyStats[dateKey].yellow++;
      else dailyStats[dateKey].red++;

      // Track submit time in minutes since midnight (in company timezone)
      const submitDt = toCompanyTimezone(new Date(checkIn.created_at), timezone);
      dailyStats[dateKey].submitMinutes.push(submitDt.hour * 60 + submitDt.minute);
    }

    // Pre-compute date range for trends (avoids per-iteration Luxon calls)
    const actualDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const dateRange = precomputeDateRange(startDate, actualDays, timezone);

    // Pre-compute each worker's assignedDateStr ONCE (avoids O(days x workers) Luxon calls)
    const workerAssignedDates = workers.map((w) => ({
      ...w,
      assignedDateStr: w.team_assigned_at
        ? formatDateInTimezone(new Date(w.team_assigned_at), timezone)
        : null,
    }));

    // Build trends array using pre-computed ranges
    const trends = [];
    let totalExpected = 0;

    for (const day of dateRange) {
      const { dateStr: dateKey, dow: dayOfWeek } = day;
      const stats = dailyStats[dateKey] || {
        count: 0,
        totalScore: 0,
        green: 0,
        yellow: 0,
        red: 0,
        submitMinutes: [] as number[],
      };

      // Count workers who were assigned BEFORE this date and it's their work day.
      // Uses pre-computed assignedDateStr instead of per-iteration Luxon conversion.
      const expectedWorkers = workerAssignedDates.filter((w) => {
        if (!w.assignedDateStr || !w.team) return false;
        if (w.assignedDateStr >= dateKey) return false; // Must be assigned BEFORE (not same day)

        // Use worker schedule if set, otherwise fallback to team schedule
        return isWorkDay(
          dayOfWeek,
          { work_days: w.work_days, check_in_start: w.check_in_start, check_in_end: w.check_in_end },
          { work_days: w.team.work_days, check_in_start: w.team.check_in_start, check_in_end: w.team.check_in_end }
        );
      }).length;

      // Skip days where no workers were expected (no work day / not yet assigned)
      if (expectedWorkers === 0 && stats.count === 0) continue;

      totalExpected += expectedWorkers;

      // Calculate average submit time (HH:MM format)
      let submitTime: string | null = null;
      if (stats.submitMinutes.length > 0) {
        const avgMinutes = Math.round(
          stats.submitMinutes.reduce((a: number, b: number) => a + b, 0) / stats.submitMinutes.length
        );
        const h = Math.floor(avgMinutes / 60)
          .toString()
          .padStart(2, '0');
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

    // Calculate overall stats
    const totalCheckIns = checkIns.length;
    const avgReadiness =
      totalCheckIns > 0
        ? Math.round(checkIns.reduce((sum, c) => sum + c.readiness_score, 0) / totalCheckIns)
        : 0;
    const greenCount = checkIns.filter((c) => c.readiness_level === 'GREEN').length;
    const yellowCount = checkIns.filter((c) => c.readiness_level === 'YELLOW').length;
    const redCount = checkIns.filter((c) => c.readiness_level === 'RED').length;

    // Build individual check-in records with person names (reuse dateLookup)
    // Cap to latest 200 records to prevent large payloads on 90d periods
    const records = checkIns.slice(0, 200).map((checkIn) => {
      const dateKey = dateLookup.get(checkIn.check_in_date.getTime()) ?? formatDateInTimezone(checkIn.check_in_date, timezone);
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
          green: greenCount,
          yellow: yellowCount,
          red: redCount,
        },
      },
      trends,
      records,
    };
  }
}
