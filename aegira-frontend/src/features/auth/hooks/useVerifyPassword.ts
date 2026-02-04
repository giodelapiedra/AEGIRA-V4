import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

export function useVerifyPassword() {
  return useMutation({
    mutationFn: (data: { password: string }) =>
      apiClient.post(ENDPOINTS.AUTH.VERIFY_PASSWORD, data),
  });
}
