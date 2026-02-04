import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type { Case } from '@/types/incident.types';

export type { Case } from '@/types/incident.types';

export function useCase(caseId: string) {
  return useQuery({
    queryKey: ['case', caseId],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: () => apiClient.get<Case>(ENDPOINTS.CASE.BY_ID(caseId)),
    enabled: !!caseId,
  });
}
