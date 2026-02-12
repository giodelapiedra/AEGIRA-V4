import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { Incident, CreateIncidentData } from '@/types/incident.types';

export function useCreateIncident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateIncidentData) =>
      apiClient.post<Incident>(ENDPOINTS.INCIDENT.CREATE, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }); // Dashboard shows incident counts
    },
  });
}
