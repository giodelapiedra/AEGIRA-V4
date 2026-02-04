import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type { Incident } from '@/types/incident.types';

export type { Incident } from '@/types/incident.types';

export function useIncident(incidentId: string) {
  return useQuery({
    queryKey: ['incident', incidentId],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: () => apiClient.get<Incident>(ENDPOINTS.INCIDENT.BY_ID(incidentId)),
    enabled: !!incidentId,
  });
}
