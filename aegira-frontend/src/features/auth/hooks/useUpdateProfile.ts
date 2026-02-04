import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  gender?: 'MALE' | 'FEMALE' | null;
  dateOfBirth?: string | null;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileData) =>
      apiClient.patch<{ message: string }>(ENDPOINTS.PERSON.UPDATE_PROFILE, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'session'] });
      queryClient.invalidateQueries({ queryKey: ['persons'] });
    },
  });
}
