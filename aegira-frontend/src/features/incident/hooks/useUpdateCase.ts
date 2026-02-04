import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { Case, UpdateCaseData } from '@/types/incident.types';

export function useUpdateCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ caseId, data }: { caseId: string; data: UpdateCaseData }) =>
      apiClient.patch<Case>(ENDPOINTS.CASE.UPDATE(caseId), data),
    onSuccess: (updatedCase, { caseId }) => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['my-incidents'] });
      if (updatedCase.incidentId) {
        queryClient.invalidateQueries({ queryKey: ['incident-timeline', updatedCase.incidentId] });
      }
    },
  });
}
