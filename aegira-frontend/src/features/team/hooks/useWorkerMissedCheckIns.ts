import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type { MissedCheckIn, MissedCheckInsResponse } from '@/types/missed-check-in.types';

// Re-export with alias for backward compatibility
export type MissedCheckInRecord = MissedCheckIn;
export type { MissedCheckIn };

interface UseWorkerMissedCheckInsParams {
  personId: string;
  page?: number;
  limit?: number;
}

export function useWorkerMissedCheckIns({ personId, page = 1, limit = 10 }: UseWorkerMissedCheckInsParams) {
  return useQuery({
    queryKey: ['worker-missed-check-ins', personId, page, limit],
    staleTime: STALE_TIMES.STANDARD,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({
        workerId: personId,
        page: String(page),
        limit: String(limit),
      });

      return apiClient.get<MissedCheckInsResponse>(
        `${ENDPOINTS.TEAM_MANAGEMENT.MISSED_CHECK_INS}?${params.toString()}`
      );
    },
    enabled: !!personId,
  });
}
