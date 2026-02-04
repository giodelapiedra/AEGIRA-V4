import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthStore, type User } from '@/stores/auth.store';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES, CACHE_TIMES } from '@/config/query.config';

/**
 * Fetches the current user session from the server.
 * The httpOnly cookie is sent automatically — if valid, we get user data back.
 * This is the single source of truth for auth state on page refresh.
 */
export function useSession() {
  const query = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      const response = await apiClient.get<{ user: User }>(ENDPOINTS.AUTH.ME);
      // Set store immediately so children have user data when they mount
      useAuthStore.getState().setAuth(response.user);
      return response;
    },
    retry: false,
    staleTime: STALE_TIMES.STANDARD, // ✅ FIX: Use constant instead of hardcoded value
    gcTime: CACHE_TIMES.MEDIUM, // ✅ FIX: Use constant instead of hardcoded value
  });

  return query;
}
