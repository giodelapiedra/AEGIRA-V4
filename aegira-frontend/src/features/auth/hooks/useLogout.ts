import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { ROUTES } from '@/config/routes.config';

export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  return useMutation({
    mutationFn: () => apiClient.post(ENDPOINTS.AUTH.LOGOUT, {}),

    onSuccess: () => {
      // Clear auth state first
      clearAuth();

      // Remove all cached data including session
      queryClient.removeQueries({ queryKey: ['auth'] });
      queryClient.removeQueries({ queryKey: ['check-ins'] });
      queryClient.removeQueries({ queryKey: ['dashboard'] });
      queryClient.removeQueries({ queryKey: ['notifications'] });
      queryClient.removeQueries({ queryKey: ['teams'] });
      queryClient.removeQueries({ queryKey: ['persons'] });
      queryClient.removeQueries({ queryKey: ['person'] });
      queryClient.removeQueries({ queryKey: ['admin'] });

      // Navigate to login
      navigate(ROUTES.LOGIN);
    },
    onError: (error: Error) => {
      // Even on error, clear local state and redirect
      clearAuth();
      queryClient.removeQueries();
      navigate(ROUTES.LOGIN);
      console.error('Logout failed:', error);
    },
  });
}
