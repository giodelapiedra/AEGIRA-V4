import type { IncidentType, IncidentSeverity, RejectionReason } from './incident.types';

export type AnalyticsPeriod = '7d' | '30d' | '90d';

export interface AnalyticsFilters {
  teamId?: string;
}

export interface TeamOption {
  id: string;
  name: string;
}

export interface WhsAnalyticsResponse {
  period: AnalyticsPeriod;
  dateRange: { start: string; end: string };
  filterOptions: { teams: TeamOption[] };
  summary: {
    totalIncidents: number;
    totalCasesCreated: number;
    avgResponseTimeHours: number | null;
    avgResolutionTimeHours: number | null;
    approvalRate: number;
    rejectionRate: number;
  };
  incidentTrends: IncidentTrendPoint[];
  incidentsByType: IncidentTypeBreakdown[];
  incidentsBySeverity: SeverityBreakdown[];
  incidentsByTeam: TeamIncidentBreakdown[];
  incidentsByGender: GenderBreakdown[];
  rejectionsByReason: RejectionBreakdown[];
}

export interface IncidentTrendPoint {
  date: string;
  total: number;
  approved: number;
  rejected: number;
  pending: number;
}

export interface IncidentTypeBreakdown {
  type: IncidentType;
  label: string;
  count: number;
  percentage: number;
}

export interface SeverityBreakdown {
  severity: IncidentSeverity;
  count: number;
  percentage: number;
}

export interface TeamIncidentBreakdown {
  teamId: string;
  teamName: string;
  count: number;
  severityBreakdown: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

export interface GenderBreakdown {
  gender: string;
  label: string;
  count: number;
  percentage: number;
}

export interface RejectionBreakdown {
  reason: RejectionReason;
  label: string;
  count: number;
  percentage: number;
}
