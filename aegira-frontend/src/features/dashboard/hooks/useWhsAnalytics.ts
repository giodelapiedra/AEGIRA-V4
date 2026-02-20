import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type { AnalyticsPeriod, AnalyticsFilters, WhsAnalyticsResponse } from '@/types/whs-analytics.types';

export type { AnalyticsPeriod, AnalyticsFilters, WhsAnalyticsResponse } from '@/types/whs-analytics.types';

/**
 * WHS Analytics — historical trends and distributions
 * GET /api/v1/dashboard/whs-analytics?period=30d&teamId=...
 */
export function useWhsAnalytics(period: AnalyticsPeriod = '30d', filters: AnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['dashboard', 'whs-analytics', period, filters],
    staleTime: STALE_TIMES.STATIC,
    placeholderData: keepPreviousData,
    queryFn: () => {
      const params = new URLSearchParams({ period });
      if (filters.teamId) params.set('teamId', filters.teamId);
      return apiClient.get<WhsAnalyticsResponse>(
        `${ENDPOINTS.DASHBOARD.WHS_ANALYTICS}?${params.toString()}`
      );
    },
  });
}
