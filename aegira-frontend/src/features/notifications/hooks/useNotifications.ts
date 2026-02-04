import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type { Notification, PaginatedResponse, NotificationUnreadCount } from '@/types/common.types';

export type { Notification, NotificationUnreadCount } from '@/types/common.types';

type NotificationFilter = 'all' | 'unread' | 'read';

interface UseNotificationsParams {
  page?: number;
  pageSize?: number;
  filter?: NotificationFilter;
}

/**
 * Server-side paginated notifications - for the full NotificationsPage
 */
export function useNotifications({ page = 1, pageSize = 20, filter = 'all' }: UseNotificationsParams = {}) {
  return useQuery({
    queryKey: ['notifications', page, pageSize, filter], // ✅ FIX: Standardize to all primitives
    staleTime: STALE_TIMES.STANDARD,
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (filter !== 'all') params.set('filter', filter);
      return apiClient.get<PaginatedResponse<Notification>>(
        `${ENDPOINTS.NOTIFICATIONS.LIST}?${params.toString()}`
      );
    },
  });
}

/**
 * Latest notifications preview - for the bell dropdown (small, limit=5)
 */
export function useNotificationPreview() {
  return useQuery({
    queryKey: ['notifications', 'preview'],
    staleTime: STALE_TIMES.REALTIME,
    queryFn: () => {
      const params = new URLSearchParams({ page: '1', limit: '5' });
      return apiClient.get<PaginatedResponse<Notification>>(
        `${ENDPOINTS.NOTIFICATIONS.LIST}?${params.toString()}`
      );
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

/**
 * Unread count - lightweight query for the bell badge
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    staleTime: STALE_TIMES.REALTIME,
    queryFn: () =>
      apiClient.get<NotificationUnreadCount>(ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT),
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      apiClient.patch(ENDPOINTS.NOTIFICATIONS.MARK_READ(notificationId), {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.patch(ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
