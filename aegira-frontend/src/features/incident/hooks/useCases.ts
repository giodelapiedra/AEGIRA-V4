import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type { CaseListResponse, CaseStatus } from '@/types/incident.types';

export type { Case, CaseStatus, CaseListResponse } from '@/types/incident.types';

interface UseCasesParams {
  page?: number;
  limit?: number;
  status?: CaseStatus;
  search?: string;
}

export function useCases({
  page = 1,
  limit = 20,
  status,
  search,
}: UseCasesParams = {}) {
  return useQuery({
    queryKey: ['cases', page, limit, status, search],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      return apiClient.get<CaseListResponse>(
        `${ENDPOINTS.CASE.LIST}?${params.toString()}`
      );
    },
  });
}
