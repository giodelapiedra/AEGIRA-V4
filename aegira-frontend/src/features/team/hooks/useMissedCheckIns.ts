import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type {
  MissedCheckIn,
  MissedCheckInsResponse,
} from '@/types/missed-check-in.types';

// Re-export types for convenience
export type { MissedCheckIn, MissedCheckInsResponse };

/**
 * Fetch missed check-ins for team management with pagination
 */
export function useMissedCheckIns(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['team', 'missed-check-ins', page, limit],
    staleTime: STALE_TIMES.STANDARD,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      return apiClient.get<MissedCheckInsResponse>(
        `${ENDPOINTS.TEAM_MANAGEMENT.MISSED_CHECK_INS}?${params.toString()}`
      );
    },
  });
}
