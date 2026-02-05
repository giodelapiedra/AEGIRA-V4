import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';

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

export interface MissedCheckInRecord {
  id: string;
  workerId: string;
  workerName: string;
  workerEmail: string;
  teamName: string;
  date: string;
  scheduleWindow: string;
  status: string;
  notes: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  reason: string;
  createdAt: string;
  stateSnapshot?: MissedCheckInStateSnapshot;
}

interface MissedCheckInsResponse {
  items: MissedCheckInRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  statusCounts: Record<string, number>;
}

interface UseWorkerMissedCheckInsParams {
  personId: string;
  page?: number;
  pageSize?: number;
}

export function useWorkerMissedCheckIns({ personId, page = 1, pageSize = 10 }: UseWorkerMissedCheckInsParams) {
  return useQuery({
    queryKey: ['worker-missed-check-ins', personId, page, pageSize], // ✅ FIX: Standardize to all primitives
    staleTime: STALE_TIMES.IMMUTABLE,
    queryFn: async () => {
      const params = new URLSearchParams({
        workerId: personId,
        page: String(page),
        limit: String(pageSize),
      });

      return apiClient.get<MissedCheckInsResponse>(
        `${ENDPOINTS.TEAM_MANAGEMENT.MISSED_CHECK_INS}?${params.toString()}`
      );
    },
    enabled: !!personId,
  });
}
