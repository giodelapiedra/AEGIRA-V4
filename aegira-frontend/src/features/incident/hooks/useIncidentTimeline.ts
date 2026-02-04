import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type { IncidentEvent } from '@/types/incident.types';

export type { IncidentEvent } from '@/types/incident.types';

export function useIncidentTimeline(incidentId: string) {
  return useQuery({
    queryKey: ['incident-timeline', incidentId],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: () =>
      apiClient.get<IncidentEvent[]>(ENDPOINTS.INCIDENT.TIMELINE(incidentId)),
    enabled: !!incidentId,
  });
}
