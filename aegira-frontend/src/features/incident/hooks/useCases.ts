import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type { CaseListResponse, CaseStatus, IncidentSeverity } from '@/types/incident.types';

export type { CaseListItem, CaseStatus, CaseListResponse } from '@/types/incident.types';

interface UseCasesParams {
  page?: number;
  limit?: number;
  status?: CaseStatus;
  severity?: IncidentSeverity;
  search?: string;
}

export function useCases({
  page = 1,
  limit = 20,
  status,
  severity,
  search,
}: UseCasesParams = {}) {
  return useQuery({
    queryKey: ['cases', page, limit, status, severity, search],
    staleTime: STALE_TIMES.STANDARD,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (status) params.set('status', status);
      if (severity) params.set('severity', severity);
      if (search) params.set('search', search);
      return apiClient.get<CaseListResponse>(
        `${ENDPOINTS.CASE.LIST}?${params.toString()}`
      );
    },
  });
}
