import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { AuthResponse } from '@/types/auth.types';

export type { AuthResponse } from '@/types/auth.types';

export interface SignupData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  companyName: string;
  timezone: string;
  industry?: string;
}

export function useSignup() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SignupData) =>
      apiClient.post<AuthResponse>(ENDPOINTS.AUTH.SIGNUP, data),
    onSuccess: (response) => {
      setAuth(response.user);
      // Pre-seed session cache so RouteGuard doesn't show spinner after signup
      queryClient.setQueryData(['auth', 'session'], response);
    },
  });
}
