import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { LoginCredentials, AuthResponse } from '@/types/auth.types';

export type { LoginCredentials, AuthResponse } from '@/types/auth.types';

export function useLogin() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginCredentials) =>
      apiClient.post<AuthResponse>(ENDPOINTS.AUTH.LOGIN, data),
    onSuccess: (response) => {
      setAuth(response.user);
      // Pre-seed session cache so RouteGuard doesn't show spinner after login
      queryClient.setQueryData(['auth', 'session'], response);
    },
  });
}
