import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import { levelToCategory } from '@/lib/utils/format.utils';
import type { BackendCheckIn, CheckIn, CheckInHistory } from '@/types/check-in.types';

export type { CheckIn, CheckInHistory } from '@/types/check-in.types';

interface BackendPaginatedResponse {
  items: BackendCheckIn[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Transform single check-in
function transformCheckIn(data: BackendCheckIn): CheckIn {
  return {
    id: data.id,
    personId: data.person_id,
    companyId: data.company_id,
    checkInDate: data.check_in_date.slice(0, 10),
    sleepHours: data.hours_slept,
    sleepQuality: data.sleep_quality,
    fatigueLevel: 11 - data.physical_condition,
    stressLevel: data.stress_level,
    painLevel: data.pain_level ?? 0,
    painLocation: data.pain_location ?? undefined,
    physicalConditionNotes: data.physical_condition_notes ?? undefined,
    notes: data.notes,
    readinessResult: {
      score: data.readiness_score,
      category: levelToCategory(data.readiness_level),
      factors: [],
      recommendations: [],
    },
    submittedAt: data.created_at,
    createdAt: data.created_at,
    updatedAt: data.created_at,
  };
}

interface UseCheckInHistoryParams {
  page?: number;
  limit?: number;
}

export function useCheckInHistory({ page = 1, limit = 10 }: UseCheckInHistoryParams = {}) {
  return useQuery({
    queryKey: ['check-ins', 'history', page, limit],
    staleTime: STALE_TIMES.IMMUTABLE, // Historical data rarely changes
    placeholderData: keepPreviousData, // Smooth pagination transitions
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      const data = await apiClient.get<BackendPaginatedResponse>(
        `${ENDPOINTS.CHECK_IN.HISTORY}?${params.toString()}`
      );

      // Transform to frontend format
      const transformed: CheckInHistory = {
        items: data.items.map(transformCheckIn),
        total: data.pagination.total,
        page: data.pagination.page,
        limit: data.pagination.limit,
        totalPages: data.pagination.totalPages,
      };

      return transformed;
    },
  });
}
