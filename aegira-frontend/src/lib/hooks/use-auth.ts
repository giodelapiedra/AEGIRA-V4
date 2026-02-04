import { useAuthStore } from '@/stores/auth.store';
import type { UserRole } from '@/types/auth.types';

export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'ADMIN';
  const isSupervisor = user?.role === 'SUPERVISOR';
  const isTeamLead = user?.role === 'TEAM_LEAD';
  const isWorker = user?.role === 'WORKER';

  const hasRole = (roles: UserRole[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return {
    user,
    isAuthenticated,
    isAdmin,
    isSupervisor,
    isTeamLead,
    isWorker,
    hasRole,
    setAuth,
    clearAuth,
  };
}
