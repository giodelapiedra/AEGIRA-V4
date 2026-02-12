import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type { PaginatedResponse } from '@/types/common.types';
import type {
  Team,
  TeamMember,
  TeamWithMembers,
  CreateTeamData,
  UpdateTeamData,
  AddTeamMemberData,
} from '@/types/team.types';

// Re-export types for convenience
export type { Team, TeamMember, TeamWithMembers, CreateTeamData, UpdateTeamData, AddTeamMemberData };

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
 * Fetch team members with pagination
 */
export function useTeamMembers(teamId: string, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['team', teamId, 'members', page, limit],
    staleTime: STALE_TIMES.STANDARD,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      const response = await apiClient.get<PaginatedResponse<TeamMember>>(
        `${ENDPOINTS.TEAM.MEMBERS(teamId)}?${params.toString()}`
      );
      return response;
    },
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

/**
 * Delete a team
 */
export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teamId: string) =>
      apiClient.delete(ENDPOINTS.TEAM.DETAIL(teamId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/**
 * Add member to team
 */
export function useAddTeamMember(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddTeamMemberData) =>
      apiClient.post(ENDPOINTS.TEAM.MEMBERS(teamId), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['persons'] });
    },
  });
}

/**
 * Remove member from team
 */
export function useRemoveTeamMember(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (personId: string) =>
      apiClient.delete(ENDPOINTS.TEAM.MEMBER(teamId, personId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['persons'] });
    },
  });
}
