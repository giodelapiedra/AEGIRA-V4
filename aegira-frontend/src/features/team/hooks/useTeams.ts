import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type { PaginatedResponse } from '@/types/common.types';
import type {
  Team,
  TeamWithMembers,
  CreateTeamData,
  UpdateTeamData,
} from '@/types/team.types';

// Re-export types for convenience
export type { Team, TeamWithMembers, CreateTeamData, UpdateTeamData };

/**
 * Fetch all teams with pagination
 */
export function useTeams(page = 1, limit = 20, includeInactive = false, search = '') {
  return useQuery({
    queryKey: ['teams', page, limit, includeInactive, search],
    staleTime: STALE_TIMES.STANDARD,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        includeInactive: String(includeInactive),
      });
      if (search) params.set('search', search);
      const response = await apiClient.get<PaginatedResponse<Team>>(
        `${ENDPOINTS.TEAM.LIST}?${params.toString()}`
      );
      return response;
    },
  });
}

/**
 * Fetch single team by ID
 */
export function useTeam(teamId: string) {
  return useQuery({
    queryKey: ['team', teamId],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: () => apiClient.get<Team>(ENDPOINTS.TEAM.BY_ID(teamId)),
    enabled: !!teamId,
  });
}

/**
 * Fetch single team with members (detailed view)
 */
export function useTeamDetail(teamId: string) {
  return useQuery({
    queryKey: ['team', teamId, 'detail'],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: () => apiClient.get<TeamWithMembers>(ENDPOINTS.TEAM.DETAIL(teamId)),
    enabled: !!teamId,
  });
}

/**
 * Create a new team
 */
export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTeamData) =>
      apiClient.post<Team>(ENDPOINTS.TEAM.CREATE, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

/**
 * Update a team
 */
export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, data }: { teamId: string; data: UpdateTeamData }) =>
      apiClient.patch<Team>(ENDPOINTS.TEAM.UPDATE(teamId), data),
    onSuccess: (_, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['team', 'my-members'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

