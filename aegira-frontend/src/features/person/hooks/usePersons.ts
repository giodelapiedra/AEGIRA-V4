import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type { PaginatedResponse } from '@/types/common.types';
import type { Person, PersonStats, CreatePersonData, UpdatePersonData } from '@/types/person.types';

// Re-export types for convenience
export type { Person, PersonStats, CreatePersonData, UpdatePersonData };

/**
 * Fetch all persons with pagination
 */
export function usePersons(page = 1, limit = 20, includeInactive = false, search = '') {
  return useQuery({
    queryKey: ['persons', page, limit, includeInactive, search],
    staleTime: STALE_TIMES.STANDARD,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        includeInactive: String(includeInactive),
      });
      if (search) params.set('search', search);
      const response = await apiClient.get<PaginatedResponse<Person>>(
        `${ENDPOINTS.PERSON.LIST}?${params.toString()}`
      );
      return response;
    },
  });
}

/**
 * Fetch team leads only (for team leader assignment)
 * Only returns team leads who are not yet assigned as leaders to any team
 * @param excludeTeamId - Optional team ID to exclude from the filter (for edit scenarios, includes the current team's leader)
 */
export function useTeamLeads(excludeTeamId?: string) {
  return useQuery({
    queryKey: ['persons', 'team-leads', 'available', excludeTeamId],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: async () => {
      const params = new URLSearchParams({
        role: 'TEAM_LEAD',
        limit: '100',
        availableOnly: 'true',
      });
      if (excludeTeamId) {
        params.append('excludeTeamId', excludeTeamId);
      }
      const response = await apiClient.get<PaginatedResponse<Person>>(
        `${ENDPOINTS.PERSON.LIST}?${params.toString()}`
      );
      return response.items;
    },
  });
}

/**
 * Fetch supervisors only
 */
export function useSupervisors() {
  return useQuery({
    queryKey: ['persons', 'supervisors'],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: async () => {
      const params = new URLSearchParams({
        role: 'SUPERVISOR',
        limit: '100',
      });
      const response = await apiClient.get<PaginatedResponse<Person>>(
        `${ENDPOINTS.PERSON.LIST}?${params.toString()}`
      );
      return response.items;
    },
  });
}

/**
 * Fetch single person by ID
 */
export function usePerson(personId: string) {
  return useQuery({
    queryKey: ['person', personId],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: () => apiClient.get<Person>(ENDPOINTS.PERSON.BY_ID(personId)),
    enabled: !!personId,
  });
}

/**
 * Get person stats (check-in streak, avg readiness, etc.)
 */
export function usePersonStats(personId: string) {
  return useQuery({
    queryKey: ['person', personId, 'stats'],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: () => apiClient.get<PersonStats>(ENDPOINTS.PERSON.STATS(personId)),
    enabled: !!personId,
  });
}

/**
 * Create a new person
 */
export function useCreatePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePersonData) =>
      apiClient.post<Person>(ENDPOINTS.PERSON.CREATE, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

/**
 * Update a person
 */
export function useUpdatePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ personId, data }: { personId: string; data: UpdatePersonData }) =>
      apiClient.patch<Person>(ENDPOINTS.PERSON.UPDATE(personId), data),
    onSuccess: (_, { personId }) => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      queryClient.invalidateQueries({ queryKey: ['person', personId] });
      queryClient.invalidateQueries({ queryKey: ['person', personId, 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['team', 'my-members'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/**
 * Cancel a pending team transfer
 */
export function useCancelTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (personId: string) =>
      apiClient.delete(ENDPOINTS.PERSON.CANCEL_TRANSFER(personId)),
    onSuccess: (_, personId) => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      queryClient.invalidateQueries({ queryKey: ['person', personId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}
