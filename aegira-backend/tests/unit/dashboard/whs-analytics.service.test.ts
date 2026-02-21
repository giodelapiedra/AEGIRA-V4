import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXED_NOW_UTC, isoDateSequence } from '../helpers/date-fixtures';
import type { MockPrismaClient } from '../helpers/mock-prisma';

const prismaMock = vi.hoisted(() => ({
  incident: {
    groupBy: vi.fn(),
  },
  case: {
    count: vi.fn(),
  },
  team: {
    findMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
})) as MockPrismaClient;

vi.mock('../../../src/config/database', () => ({
  prisma: prismaMock,
}));

import { WhsAnalyticsService } from '../../../src/modules/dashboard/whs-analytics.service';

interface MockData {
  statusGroups: Array<{ status: string; _count: { id: number } }>;
  trendRows: Array<{ date: string; status: string; count: number }>;
  teamSeverityRows: Array<{ team_id: string; team_name: string; severity: string; count: number }>;
  typeGroups: Array<{ incident_type: string; _count: { id: number } }>;
  severityGroups: Array<{ severity: string; _count: { id: number } }>;
  rejectionGroups: Array<{ rejection_reason: string | null; _count: { id: number } }>;
  avgResponseRows: Array<{ avg_hours: number | null }>;
  casesCreatedCount: number;
  avgResolutionRows: Array<{ avg_hours: number | null }>;
  allTeams: Array<{ id: string; name: string }>;
  genderRows: Array<{ gender: string; count: number }>;
}

function defaultMockData(): MockData {
  return {
    statusGroups: [
      { status: 'APPROVED', _count: { id: 2 } },
      { status: 'REJECTED', _count: { id: 1 } },
      { status: 'PENDING', _count: { id: 1 } },
    ],
    trendRows: [
      { date: '2026-01-22', status: 'APPROVED', count: 1 },
      { date: '2026-01-22', status: 'REJECTED', count: 1 },
      { date: '2026-01-24', status: 'PENDING', count: 1 },
      { date: '2026-01-25', status: 'APPROVED', count: 1 },
    ],
    teamSeverityRows: [
      { team_id: 'team-a', team_name: 'Alpha', severity: 'HIGH', count: 2 },
      { team_id: 'team-a', team_name: 'Alpha', severity: 'LOW', count: 1 },
      { team_id: 'team-b', team_name: 'Beta', severity: 'CRITICAL', count: 1 },
    ],
    typeGroups: [
      { incident_type: 'PHYSICAL_INJURY', _count: { id: 3 } },
      { incident_type: 'OTHER', _count: { id: 1 } },
    ],
    severityGroups: [
      { severity: 'HIGH', _count: { id: 2 } },
      { severity: 'LOW', _count: { id: 1 } },
      { severity: 'CRITICAL', _count: { id: 1 } },
    ],
    rejectionGroups: [{ rejection_reason: 'INSUFFICIENT_INFORMATION', _count: { id: 1 } }],
    avgResponseRows: [{ avg_hours: 5.5 }],
    casesCreatedCount: 3,
    avgResolutionRows: [{ avg_hours: 12.25 }],
    allTeams: [
      { id: 'team-a', name: 'Alpha' },
      { id: 'team-b', name: 'Beta' },
    ],
    genderRows: [
      { gender: 'MALE', count: 3 },
      { gender: 'FEMALE', count: 1 },
    ],
  };
}

function setMockResponses(overrides: Partial<MockData> = {}): MockData {
  const data = { ...defaultMockData(), ...overrides };

  prismaMock.incident.groupBy
    .mockResolvedValueOnce(data.statusGroups)
    .mockResolvedValueOnce(data.typeGroups)
    .mockResolvedValueOnce(data.severityGroups)
    .mockResolvedValueOnce(data.rejectionGroups);

  prismaMock.$queryRaw
    .mockResolvedValueOnce(data.trendRows)
    .mockResolvedValueOnce(data.teamSeverityRows)
    .mockResolvedValueOnce(data.avgResponseRows)
    .mockResolvedValueOnce(data.avgResolutionRows)
    .mockResolvedValueOnce(data.genderRows);

  prismaMock.case.count.mockResolvedValueOnce(data.casesCreatedCount);
  prismaMock.team.findMany.mockResolvedValueOnce(data.allTeams);

  return data;
}

describe('WhsAnalyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW_UTC);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns expected summary and transformed datasets for happy path', async () => {
    setMockResponses();
    const service = new WhsAnalyticsService('company-1', 'Asia/Manila');

    const result = await service.getAnalytics('30d');

    expect(prismaMock.incident.groupBy).toHaveBeenCalledTimes(4);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(5);
    expect(prismaMock.case.count).toHaveBeenCalledTimes(1);
    expect(prismaMock.team.findMany).toHaveBeenCalledTimes(1);

    expect(result.summary).toEqual({
      totalIncidents: 4,
      totalCasesCreated: 3,
      avgResponseTimeHours: 5.5,
      avgResolutionTimeHours: 12.25,
      approvalRate: 50,
      rejectionRate: 25,
    });
    expect(result.filterOptions.teams).toEqual([
      { id: 'team-a', name: 'Alpha' },
      { id: 'team-b', name: 'Beta' },
    ]);
    expect(result.incidentsByType[0]?.label).toBe('Physical Injury');
    expect(result.incidentsByTeam[0]?.teamId).toBe('team-a');
    expect(result.incidentsByTeam[0]?.count).toBeGreaterThan(result.incidentsByTeam[1]?.count ?? 0);
  });

  it('maps periods to correct date ranges and trend lengths', async () => {
    const periods: Array<{ period: '7d' | '30d' | '90d'; expectedDays: number }> = [
      { period: '7d', expectedDays: 8 },
      { period: '30d', expectedDays: 31 },
      { period: '90d', expectedDays: 91 },
    ];

    for (const { period, expectedDays } of periods) {
      setMockResponses();
      const service = new WhsAnalyticsService('company-1', 'Asia/Manila');
      const result = await service.getAnalytics(period);

      const start = new Date(result.dateRange.start);
      const end = new Date(result.dateRange.end);
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      expect(result.period).toBe(period);
      expect(diffDays).toBe(expectedDays);
      expect(result.incidentTrends).toHaveLength(expectedDays);
      vi.clearAllMocks();
    }
  });

  it('propagates team filters into Prisma where conditions', async () => {
    setMockResponses();
    const service = new WhsAnalyticsService('company-1', 'Asia/Manila');

    await service.getAnalytics('30d', { teamId: 'team-a' });

    const statusGroupArgs = prismaMock.incident.groupBy.mock.calls[0]?.[0];
    const typeGroupArgs = prismaMock.incident.groupBy.mock.calls[1]?.[0];
    const severityGroupArgs = prismaMock.incident.groupBy.mock.calls[2]?.[0];
    const rejectionGroupArgs = prismaMock.incident.groupBy.mock.calls[3]?.[0];
    const caseCountArgs = prismaMock.case.count.mock.calls[0]?.[0];

    expect(statusGroupArgs.where.reporter.team_id).toBe('team-a');
    expect(typeGroupArgs.where.reporter.team_id).toBe('team-a');
    expect(severityGroupArgs.where.reporter.team_id).toBe('team-a');
    expect(rejectionGroupArgs.where.reporter.team_id).toBe('team-a');
    expect(caseCountArgs.where.incident.reporter.team_id).toBe('team-a');
  });

  it('zero-fills missing trend dates', async () => {
    setMockResponses({
      trendRows: [{ date: '2026-02-14', status: 'APPROVED', count: 2 }],
      statusGroups: [{ status: 'APPROVED', _count: { id: 2 } }],
    });
    const service = new WhsAnalyticsService('company-1', 'Asia/Manila');
    const result = await service.getAnalytics('7d');

    const expectedDates = isoDateSequence(result.incidentTrends[0]!.date, result.incidentTrends.length);
    expect(result.incidentTrends).toHaveLength(8);
    expect(result.incidentTrends.map((d) => d.date)).toEqual(expectedDates);

    const nonDataDays = result.incidentTrends.filter((d) => d.date !== '2026-02-14');
    expect(nonDataDays.every((d) => d.total === 0 && d.approved === 0 && d.rejected === 0 && d.pending === 0)).toBe(true);
  });

  it('ignores unknown severities in team severity breakdown', async () => {
    setMockResponses({
      teamSeverityRows: [
        { team_id: 'team-a', team_name: 'Alpha', severity: 'HIGH', count: 2 },
        { team_id: 'team-a', team_name: 'Alpha', severity: 'SEVERE', count: 99 },
      ],
    });
    const service = new WhsAnalyticsService('company-1', 'Asia/Manila');
    const result = await service.getAnalytics('30d');

    expect(result.incidentsByTeam[0]).toEqual({
      teamId: 'team-a',
      teamName: 'Alpha',
      count: 101,
      severityBreakdown: {
        low: 0,
        medium: 0,
        high: 2,
        critical: 0,
      },
    });
  });

  it('computes percentages and rounds summary rates safely', async () => {
    setMockResponses({
      statusGroups: [
        { status: 'APPROVED', _count: { id: 1 } },
        { status: 'REJECTED', _count: { id: 1 } },
        { status: 'PENDING', _count: { id: 1 } },
      ],
      typeGroups: [
        { incident_type: 'PHYSICAL_INJURY', _count: { id: 2 } },
        { incident_type: 'OTHER', _count: { id: 1 } },
      ],
      severityGroups: [
        { severity: 'HIGH', _count: { id: 2 } },
        { severity: 'LOW', _count: { id: 1 } },
      ],
      rejectionGroups: [{ rejection_reason: 'OTHER', _count: { id: 1 } }],
      genderRows: [
        { gender: 'MALE', count: 2 },
        { gender: 'FEMALE', count: 1 },
      ],
    });
    const service = new WhsAnalyticsService('company-1', 'Asia/Manila');
    const result = await service.getAnalytics('30d');

    expect(result.summary.approvalRate).toBe(33.3);
    expect(result.summary.rejectionRate).toBe(33.3);
    expect(result.incidentsByType[0]?.percentage).toBeCloseTo(66.666, 2);
    expect(result.incidentsBySeverity[0]?.percentage).toBeCloseTo(66.666, 2);
    expect(result.rejectionsByReason[0]?.percentage).toBe(100);
    expect(result.incidentsByGender[0]?.percentage).toBeCloseTo(66.666, 2);
  });

  it('returns stable empty structures for empty datasets and null averages', async () => {
    setMockResponses({
      statusGroups: [],
      trendRows: [],
      teamSeverityRows: [],
      typeGroups: [],
      severityGroups: [],
      rejectionGroups: [],
      avgResponseRows: [{ avg_hours: null }],
      casesCreatedCount: 0,
      avgResolutionRows: [{ avg_hours: null }],
      allTeams: [],
      genderRows: [],
    });
    const service = new WhsAnalyticsService('company-1', 'Asia/Manila');
    const result = await service.getAnalytics('30d');

    expect(result.summary.totalIncidents).toBe(0);
    expect(result.summary.totalCasesCreated).toBe(0);
    expect(result.summary.approvalRate).toBe(0);
    expect(result.summary.rejectionRate).toBe(0);
    expect(result.summary.avgResponseTimeHours).toBeNull();
    expect(result.summary.avgResolutionTimeHours).toBeNull();
    expect(result.incidentsByType).toEqual([]);
    expect(result.incidentsBySeverity).toEqual([]);
    expect(result.incidentsByTeam).toEqual([]);
    expect(result.rejectionsByReason).toEqual([]);
    expect(result.incidentsByGender).toEqual([]);
  });

  it('keeps team filter options unfiltered to all active teams', async () => {
    setMockResponses({
      allTeams: [
        { id: 'team-a', name: 'Alpha' },
        { id: 'team-z', name: 'Zeta' },
      ],
      teamSeverityRows: [{ team_id: 'team-a', team_name: 'Alpha', severity: 'LOW', count: 1 }],
    });
    const service = new WhsAnalyticsService('company-1', 'Asia/Manila');
    const result = await service.getAnalytics('30d', { teamId: 'team-a' });

    expect(result.filterOptions.teams).toEqual([
      { id: 'team-a', name: 'Alpha' },
      { id: 'team-z', name: 'Zeta' },
    ]);
  });
});
