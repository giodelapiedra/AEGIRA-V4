import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { Incident } from '@/types/incident.types';

export function useApproveIncident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (incidentId: string) =>
      apiClient.patch<Incident>(ENDPOINTS.INCIDENT.APPROVE(incidentId), {}),
    onSuccess: (_, incidentId) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incident', incidentId] });
      queryClient.invalidateQueries({ queryKey: ['incident-timeline', incidentId] });
      queryClient.invalidateQueries({ queryKey: ['my-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
