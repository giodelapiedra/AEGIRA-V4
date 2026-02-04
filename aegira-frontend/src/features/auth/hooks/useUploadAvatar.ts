import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

export interface UploadAvatarResponse {
  profilePictureUrl: string;
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('avatar', file);
      return apiClient.upload<UploadAvatarResponse>(ENDPOINTS.PERSON.UPLOAD_AVATAR, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'session'] });
      queryClient.invalidateQueries({ queryKey: ['persons'] });
    },
  });
}
