import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';

export interface CheckInStatus {
  isWorkDay: boolean;
  isHoliday: boolean;
  holidayName: string | null;
  isWithinWindow: boolean;
  canCheckIn: boolean;
  hasCheckedInToday: boolean;
  schedule: {
    checkInStart: string;
    checkInEnd: string;
    workDays: string[];
  } | null;
  team: {
    id: string;
    name: string;
  } | null;
  message: string;
}

export function useCheckInStatus() {
  return useQuery({
    queryKey: ['check-ins', 'status'],
    staleTime: STALE_TIMES.REALTIME, // Real-time status updates
    queryFn: () => apiClient.get<CheckInStatus>(ENDPOINTS.CHECK_IN.STATUS),
    // Refetch periodically to update window status
    refetchInterval: 60000, // Every minute
  });
}
