import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type { IncidentListResponse, IncidentStatus } from '@/types/incident.types';

export type { Incident, IncidentStatus, IncidentListResponse } from '@/types/incident.types';

export function useMyIncidents(page = 1, limit = 20, status?: IncidentStatus) {
  return useQuery({
    queryKey: ['my-incidents', page, limit, status],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (status) params.set('status', status);
      return apiClient.get<IncidentListResponse>(
        `${ENDPOINTS.INCIDENT.MY}?${params.toString()}`
      );
    },
  });
}
