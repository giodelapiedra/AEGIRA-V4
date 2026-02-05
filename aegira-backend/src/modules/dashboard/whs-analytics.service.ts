// WHS Analytics Service - Historical Trends & Distributions
import { prisma } from '../../config/database';
import { DateTime } from 'luxon';

// Human-readable labels for incident types
const INCIDENT_TYPE_LABELS: Record<string, string> = {
  PHYSICAL_INJURY: 'Physical Injury',
  ILLNESS_SICKNESS: 'Illness / Sickness',
  MENTAL_HEALTH: 'Mental Health',
  MEDICAL_EMERGENCY: 'Medical Emergency',
  HEALTH_SAFETY_CONCERN: 'Health & Safety Concern',
  OTHER: 'Other',
};

// Human-readable labels for rejection reasons
const REJECTION_REASON_LABELS: Record<string, string> = {
  DUPLICATE_REPORT: 'Duplicate Report',
  INSUFFICIENT_INFORMATION: 'Insufficient Information',
  NOT_WORKPLACE_INCIDENT: 'Not a Workplace Incident',
  OTHER: 'Other',
};

type AnalyticsPeriod = '7d' | '30d' | '90d';

const VALID_SEVERITY_KEYS = new Set(['low', 'medium', 'high', 'critical']);

interface WhsAnalyticsResult {
  period: AnalyticsPeriod;
  dateRange: { start: string; end: string };
  summary: {
    totalIncidents: number;
    totalCasesCreated: number;
    avgResponseTimeHours: number | null;
    avgResolutionTimeHours: number | null;
    approvalRate: number;
    rejectionRate: number;
  };
  incidentTrends: { date: string; total: number; approved: number; rejected: number; pending: number }[];
  incidentsByType: { type: string; label: string; count: number; percentage: number }[];
  incidentsBySeverity: { severity: string; count: number; percentage: number }[];
  incidentsByTeam: { teamId: string; teamName: string; count: number; severityBreakdown: { low: number; medium: number; high: number; critical: number } }[];
  rejectionsByReason: { reason: string; label: string; count: number; percentage: number }[];
}

// Raw SQL result types
interface TrendRow { date: string; status: string; count: number }
interface TeamSeverityRow { team_id: string; team_name: string; severity: string; count: number }
interface AvgRow { avg_hours: number | null }

function periodToDays(period: AnalyticsPeriod): number {
  switch (period) {
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
  }
}

export class WhsAnalyticsService {
  constructor(
    private readonly companyId: string,
    private readonly timezone: string = 'Asia/Manila'
  ) {}

  async getAnalytics(period: AnalyticsPeriod = '30d'): Promise<WhsAnalyticsResult> {
    const days = periodToDays(period);
    const now = DateTime.now().setZone(this.timezone);
    const endDate = now.startOf('day').plus({ days: 1 }).toJSDate(); // start of tomorrow
    const startDate = now.minus({ days }).startOf('day').toJSDate();

    const companyId = this.companyId;
    const tz = this.timezone;

    // 9 parallel queries — all aggregation done in PostgreSQL
    const [
      statusGroups,
      trendRows,
      teamSeverityRows,
      typeGroups,
      severityGroups,
      rejectionGroups,
      avgResponseRows,
      casesCreatedCount,
      avgResolutionRows,
    ] = await Promise.all([
      // Q1: Incidents grouped by status (for summary counts + rates)
      prisma.incident.groupBy({
        by: ['status'],
        where: { company_id: companyId, created_at: { gte: startDate, lt: endDate } },
        _count: { id: true },
      }),

      // Q2a: Trend data — GROUP BY date + status in PostgreSQL
      prisma.$queryRaw<TrendRow[]>`
        SELECT
          ((i.created_at AT TIME ZONE ${tz})::date)::text AS date,
          i.status::text AS status,
          COUNT(*)::int AS count
        FROM incidents i
        WHERE i.company_id = ${companyId}
          AND i.created_at >= ${startDate}
          AND i.created_at < ${endDate}
        GROUP BY 1, 2
        ORDER BY 1
      `,

      // Q2b: Team × severity breakdown — JOIN + GROUP BY in PostgreSQL
      prisma.$queryRaw<TeamSeverityRow[]>`
        SELECT
          COALESCE(t.id::text, 'unassigned') AS team_id,
          COALESCE(t.name, 'Unassigned') AS team_name,
          i.severity::text AS severity,
          COUNT(*)::int AS count
        FROM incidents i
        LEFT JOIN persons p ON p.id = i.reporter_id
        LEFT JOIN teams t ON t.id = p.team_id
        WHERE i.company_id = ${companyId}
          AND i.created_at >= ${startDate}
          AND i.created_at < ${endDate}
        GROUP BY t.id, t.name, i.severity
      `,

      // Q3: Incidents grouped by type
      prisma.incident.groupBy({
        by: ['incident_type'],
        where: { company_id: companyId, created_at: { gte: startDate, lt: endDate } },
        _count: { id: true },
      }),

      // Q4: Incidents grouped by severity
      prisma.incident.groupBy({
        by: ['severity'],
        where: { company_id: companyId, created_at: { gte: startDate, lt: endDate } },
        _count: { id: true },
      }),

      // Q5: Rejected incidents grouped by reason
      prisma.incident.groupBy({
        by: ['rejection_reason'],
        where: {
          company_id: companyId,
          created_at: { gte: startDate, lt: endDate },
          status: 'REJECTED',
          rejection_reason: { not: null },
        },
        _count: { id: true },
      }),

      // Q6: Avg response time — computed in PostgreSQL
      prisma.$queryRaw<AvgRow[]>`
        SELECT
          AVG(EXTRACT(EPOCH FROM (i.reviewed_at - i.created_at)) / 3600)::float AS avg_hours
        FROM incidents i
        WHERE i.company_id = ${companyId}
          AND i.created_at >= ${startDate}
          AND i.created_at < ${endDate}
          AND i.reviewed_at IS NOT NULL
      `,

      // Q7: Cases created count
      prisma.case.count({
        where: { company_id: companyId, created_at: { gte: startDate, lt: endDate } },
      }),

      // Q8: Avg resolution time — computed in PostgreSQL
      prisma.$queryRaw<AvgRow[]>`
        SELECT
          AVG(EXTRACT(EPOCH FROM (c.resolved_at - c.created_at)) / 3600)::float AS avg_hours
        FROM cases c
        WHERE c.company_id = ${companyId}
          AND c.created_at >= ${startDate}
          AND c.created_at < ${endDate}
          AND c.resolved_at IS NOT NULL
      `,
    ]);

    // --- Process Q1: Summary ---
    let totalIncidents = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    for (const group of statusGroups) {
      totalIncidents += group._count.id;
      if (group.status === 'APPROVED') approvedCount = group._count.id;
      if (group.status === 'REJECTED') rejectedCount = group._count.id;
    }
    const approvalRate = totalIncidents > 0 ? (approvedCount / totalIncidents) * 100 : 0;
    const rejectionRate = totalIncidents > 0 ? (rejectedCount / totalIncidents) * 100 : 0;

    // --- Process Q6 + Q8: Averages (already computed by PostgreSQL) ---
    const avgResponseTimeHours = avgResponseRows[0]?.avg_hours ?? null;
    const avgResolutionTimeHours = avgResolutionRows[0]?.avg_hours ?? null;

    // --- Process Q2a: Pivot trend rows into date-keyed map ---
    const trendMap = new Map<string, { total: number; approved: number; rejected: number; pending: number }>();
    for (const row of trendRows) {
      if (!trendMap.has(row.date)) {
        trendMap.set(row.date, { total: 0, approved: 0, rejected: 0, pending: 0 });
      }
      const bucket = trendMap.get(row.date)!;
      bucket.total += row.count;
      if (row.status === 'APPROVED') bucket.approved += row.count;
      else if (row.status === 'REJECTED') bucket.rejected += row.count;
      else if (row.status === 'PENDING') bucket.pending += row.count;
    }

    // Zero-fill missing dates so the chart doesn't interpolate over gaps
    const zeroBucket = { total: 0, approved: 0, rejected: 0, pending: 0 };
    const incidentTrends: WhsAnalyticsResult['incidentTrends'] = [];
    let cursor = DateTime.fromJSDate(startDate).setZone(this.timezone);
    const endDt = DateTime.fromJSDate(endDate).setZone(this.timezone);
    while (cursor < endDt) {
      const dateKey = cursor.toISODate()!;
      incidentTrends.push({ date: dateKey, ...(trendMap.get(dateKey) ?? zeroBucket) });
      cursor = cursor.plus({ days: 1 });
    }

    // --- Process Q2b: Pivot team × severity rows into team breakdown ---
    const teamMap = new Map<string, { teamName: string; count: number; low: number; medium: number; high: number; critical: number }>();
    for (const row of teamSeverityRows) {
      if (!teamMap.has(row.team_id)) {
        teamMap.set(row.team_id, { teamName: row.team_name, count: 0, low: 0, medium: 0, high: 0, critical: 0 });
      }
      const team = teamMap.get(row.team_id)!;
      team.count += row.count;
      const sevKey = row.severity.toLowerCase();
      if (VALID_SEVERITY_KEYS.has(sevKey)) {
        team[sevKey as 'low' | 'medium' | 'high' | 'critical'] += row.count;
      }
    }
    const incidentsByTeam = Array.from(teamMap.entries())
      .map(([teamId, vals]) => ({
        teamId,
        teamName: vals.teamName,
        count: vals.count,
        severityBreakdown: { low: vals.low, medium: vals.medium, high: vals.high, critical: vals.critical },
      }))
      .sort((a, b) => b.count - a.count);

    // --- Process Q3: Incidents by type ---
    const totalByType = typeGroups.reduce((s, g) => s + g._count.id, 0);
    const incidentsByType = typeGroups
      .map((g) => ({
        type: g.incident_type,
        label: INCIDENT_TYPE_LABELS[g.incident_type] ?? g.incident_type,
        count: g._count.id,
        percentage: totalByType > 0 ? (g._count.id / totalByType) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // --- Process Q4: Incidents by severity ---
    const totalBySev = severityGroups.reduce((s, g) => s + g._count.id, 0);
    const incidentsBySeverity = severityGroups
      .map((g) => ({
        severity: g.severity,
        count: g._count.id,
        percentage: totalBySev > 0 ? (g._count.id / totalBySev) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // --- Process Q5: Rejections by reason ---
    const totalRejections = rejectionGroups.reduce((s, g) => s + g._count.id, 0);
    const rejectionsByReason = rejectionGroups
      .filter((g) => g.rejection_reason !== null)
      .map((g) => ({
        reason: g.rejection_reason!,
        label: REJECTION_REASON_LABELS[g.rejection_reason!] ?? g.rejection_reason!,
        count: g._count.id,
        percentage: totalRejections > 0 ? (g._count.id / totalRejections) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      summary: {
        totalIncidents,
        totalCasesCreated: casesCreatedCount,
        avgResponseTimeHours,
        avgResolutionTimeHours,
        approvalRate: Math.round(approvalRate * 10) / 10,
        rejectionRate: Math.round(rejectionRate * 10) / 10,
      },
      incidentTrends,
      incidentsByType,
      incidentsBySeverity,
      incidentsByTeam,
      rejectionsByReason,
    };
  }
}
