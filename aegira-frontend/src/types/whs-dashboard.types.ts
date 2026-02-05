import type { IncidentSeverity, IncidentType } from './incident.types';

// ============================================================
// WHS Dashboard — Stats Response
// ============================================================

export interface WhsDashboardStats {
  // Summary counts
  pendingIncidentsCount: number;
  myCasesCount: number; // OPEN + INVESTIGATING, assigned to current user
  totalOpenCasesCount: number; // OPEN + INVESTIGATING, all officers
  resolvedThisMonthCount: number;

  // Cases breakdown
  casesByStatus: {
    open: number;
    investigating: number;
    resolved: number;
    closed: number;
  };

  // Pending incidents (top 5 for dashboard table)
  pendingIncidents: PendingIncidentRow[];

  // Recent activity
  recentActivity: ActivityEvent[];
}

// ============================================================
// Pending Incident Row (compact, for dashboard table)
// ============================================================

export interface PendingIncidentRow {
  id: string;
  incidentNumber: number;
  title: string;
  reporterName: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  createdAt: string;
}

// ============================================================
// Activity Event
// ============================================================

export interface ActivityEvent {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  actionUrl?: string;
}
