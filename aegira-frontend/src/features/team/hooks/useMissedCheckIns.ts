import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';

// Types
export type MissedCheckInStatus = 'OPEN' | 'INVESTIGATING' | 'EXCUSED' | 'RESOLVED';

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
  date: string;
  scheduleWindow: string;
  status: MissedCheckInStatus;
  notes: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  reason: string;
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
  statusCounts: Partial<Record<MissedCheckInStatus, number>>;
}

/**
 * Fetch missed check-ins for team management with pagination and filtering
 */
export function useMissedCheckIns(page = 1, limit = 20, status = '') {
  return useQuery({
    queryKey: ['team', 'missed-check-ins', page, limit, status],
    staleTime: STALE_TIMES.STANDARD,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (status && status !== 'ALL') params.set('status', status);
      return apiClient.get<MissedCheckInsResponse>(
        `${ENDPOINTS.TEAM_MANAGEMENT.MISSED_CHECK_INS}?${params.toString()}`
      );
    },
  });
}

/**
 * Update missed check-in status
 */
export function useUpdateMissedCheckInStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: MissedCheckInStatus }) =>
      apiClient.patch(ENDPOINTS.TEAM_MANAGEMENT.UPDATE_MISSED_CHECK_IN(id), { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', 'missed-check-ins'] });
    },
  });
}
