import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export function useChangePassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ChangePasswordData) =>
      apiClient.patch<{ message: string }>(ENDPOINTS.AUTH.CHANGE_PASSWORD, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'session'] });
    },
  });
}
