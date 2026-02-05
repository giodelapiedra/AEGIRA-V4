import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type {
  WorkerDashboardStats,
  TeamLeadDashboardStats,
  SupervisorDashboardStats,
  AdminDashboardStats,
} from '@/types/check-in.types';
import type { WhsDashboardStats } from '@/types/whs-dashboard.types';

export type { WorkerDashboardStats, TeamLeadDashboardStats, SupervisorDashboardStats, AdminDashboardStats } from '@/types/check-in.types';
export type { WhsDashboardStats } from '@/types/whs-dashboard.types';

/**
 * Worker dashboard stats
 * GET /api/v1/dashboard/worker
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'worker'],
    staleTime: STALE_TIMES.STANDARD, // ✅ FIX: Worker dashboard updates when check-in submitted (2min instead of 10min)
    queryFn: () => apiClient.get<WorkerDashboardStats>(ENDPOINTS.DASHBOARD.WORKER),
  });
}

/**
 * Team lead dashboard stats
 * GET /api/v1/dashboard/team-lead
 */
export function useTeamLeadDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'team-lead'],
    staleTime: STALE_TIMES.STANDARD,
    refetchOnWindowFocus: true,
    queryFn: () => apiClient.get<TeamLeadDashboardStats>(ENDPOINTS.DASHBOARD.TEAM_LEAD),
  });
}

/**
 * Supervisor dashboard stats
 * GET /api/v1/dashboard/supervisor
 */
export function useSupervisorDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'supervisor'],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: () => apiClient.get<SupervisorDashboardStats>(ENDPOINTS.DASHBOARD.SUPERVISOR),
  });
}

/**
 * Admin dashboard stats
 * GET /api/v1/dashboard/admin
 */
export function useAdminDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'admin'],
    staleTime: STALE_TIMES.STATIC,
    queryFn: () => apiClient.get<AdminDashboardStats>(ENDPOINTS.DASHBOARD.ADMIN),
  });
}

/**
 * WHS dashboard stats
 * GET /api/v1/dashboard/whs
 */
export function useWhsDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'whs'],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: () => apiClient.get<WhsDashboardStats>(ENDPOINTS.DASHBOARD.WHS),
  });
}
