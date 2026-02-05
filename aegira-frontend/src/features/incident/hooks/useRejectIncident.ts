import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { Incident, RejectIncidentData } from '@/types/incident.types';

export function useRejectIncident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      incidentId,
      data,
    }: {
      incidentId: string;
      data: RejectIncidentData;
    }) => apiClient.patch<Incident>(ENDPOINTS.INCIDENT.REJECT(incidentId), data),
    onSuccess: (_, { incidentId }) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incident', incidentId] });
      queryClient.invalidateQueries({ queryKey: ['incident-timeline', incidentId] });
      queryClient.invalidateQueries({ queryKey: ['my-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
