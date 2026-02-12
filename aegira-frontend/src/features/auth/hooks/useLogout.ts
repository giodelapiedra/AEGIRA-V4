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

      // Remove ALL cached query data to prevent data leakage between sessions
      queryClient.removeQueries();

      // Navigate to login
      navigate(ROUTES.LOGIN);
    },
    onError: (error: Error) => {
      // Even on error, clear local state and redirect
      clearAuth();
      queryClient.removeQueries();
      navigate(ROUTES.LOGIN);
      if (import.meta.env.DEV) {
        console.error('Logout failed:', error);
      }
    },
  });
}
