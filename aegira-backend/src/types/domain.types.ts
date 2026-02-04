// Domain Types for AEGIRA
// These extend/re-export Prisma types with additional business logic types

import type {
  Role,
  ReadinessLevel,
  EventType,
  NotificationType
} from '@prisma/client';

// Re-export Prisma enums
export { Role, ReadinessLevel, EventType, NotificationType };

// Check-in input data (from user)
export interface CheckInInput {
  hoursSlept: number;
  sleepQuality: number;     // 1-10
  stressLevel: number;      // 1-10
  physicalCondition: number; // 1-10
  painLevel?: number;        // 0-10 (0 = no pain)
  painLocation?: string;     // Dropdown selection
  physicalConditionNotes?: string; // Free-text physical condition notes
  notes?: string;
}

// Calculated readiness score
export interface ReadinessScore {
  overall: number;          // 0-100
  level: ReadinessLevel;
  factors: {
    sleep: number;          // 0-100
    stress: number;         // 0-100
    physical: number;       // 0-100
    pain: number | null;    // 0-100 (null if no pain reported)
  };
}

// Dashboard summary types
export interface AdminDashboardSummary {
  totalTeams: number;
  activeTeams: number;
  inactiveTeams: number;
  totalWorkers: number;
  totalTeamLeads: number;
  totalSupervisors: number;
  unassignedWorkers: number; // Workers not assigned to any team
}

export interface TeamSummary {
  teamId: string;
  teamName: string;
  memberCount: number;
  checkedInCount: number;
  averageReadiness: number;
  readinessDistribution: {
    green: number;
    yellow: number;
    red: number;
  };
}

// Trend data for charts
export interface ReadinessTrend {
  date: string;
  averageScore: number;
  checkInCount: number;
}
