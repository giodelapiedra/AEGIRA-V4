import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type {
  IncidentListResponse,
  IncidentStatus,
  IncidentSeverity,
  IncidentType,
} from '@/types/incident.types';

export type { IncidentListResponse } from '@/types/incident.types';

interface UseIncidentsParams {
  page?: number;
  limit?: number;
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  type?: IncidentType;
  search?: string;
}

export function useIncidents({
  page = 1,
  limit = 20,
  status,
  severity,
  type,
  search,
}: UseIncidentsParams = {}) {
  return useQuery({
    queryKey: ['incidents', page, limit, status, severity, type, search],
    staleTime: STALE_TIMES.STANDARD,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (status) params.set('status', status);
      if (severity) params.set('severity', severity);
      if (type) params.set('type', type);
      if (search) params.set('search', search);
      return apiClient.get<IncidentListResponse>(
        `${ENDPOINTS.INCIDENT.LIST}?${params.toString()}`
      );
    },
  });
}
