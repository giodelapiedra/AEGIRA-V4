/**
 * Missed Check-In Types - Must match backend API response
 * Backend: src/modules/missed-check-in/missed-check-in.controller.ts
 */

export interface MissedCheckInStateSnapshot {
  dayOfWeek: number | null;
  checkInStreakBefore: number | null;
  recentReadinessAvg: number | null;
  daysSinceLastCheckIn: number | null;
  daysSinceLastMiss: number | null;
  missesInLast30d: number | null;
  missesInLast60d: number | null;
  missesInLast90d: number | null;
  baselineCompletionRate: number | null;
  isFirstMissIn30d: boolean | null;
  isIncreasingFrequency: boolean | null;
}

export interface MissedCheckIn {
  id: string;
  workerId: string;
  workerName: string;
  workerEmail: string;
  teamName: string;
  teamLeaderId: string | null;
  teamLeaderName: string | null;
  date: string;
  scheduleWindow: string;
  createdAt: string;
  stateSnapshot?: MissedCheckInStateSnapshot;
}

export interface MissedCheckInsResponse {
  items: MissedCheckIn[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
