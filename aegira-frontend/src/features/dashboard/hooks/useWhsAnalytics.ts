import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type { AnalyticsPeriod, WhsAnalyticsResponse } from '@/types/whs-analytics.types';

export type { AnalyticsPeriod, WhsAnalyticsResponse } from '@/types/whs-analytics.types';

/**
 * WHS Analytics — historical trends and distributions
 * GET /api/v1/dashboard/whs-analytics?period=30d
 */
export function useWhsAnalytics(period: AnalyticsPeriod = '30d') {
  return useQuery({
    queryKey: ['dashboard', 'whs-analytics', period],
    staleTime: STALE_TIMES.STATIC,
    placeholderData: keepPreviousData,
    queryFn: () => {
      const params = new URLSearchParams({ period });
      return apiClient.get<WhsAnalyticsResponse>(
        `${ENDPOINTS.DASHBOARD.WHS_ANALYTICS}?${params.toString()}`
      );
    },
  });
}
