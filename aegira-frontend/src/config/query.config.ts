import { QueryClient } from '@tanstack/react-query';

/**
 * Stale time constants for different data types
 * - Determines how long data is considered fresh before refetching
 */
export const STALE_TIMES = {
  /** Real-time data that changes frequently (notifications, status) */
  REALTIME: 1000 * 30, // 30 seconds

  /** Standard data that updates occasionally (teams, workers) */
  STANDARD: 1000 * 60 * 2, // 2 minutes

  /** Semi-static data that rarely changes (company settings, holidays) */
  STATIC: 1000 * 60 * 10, // 10 minutes

  /** Historical/immutable data (check-in history, audit logs) */
  IMMUTABLE: 1000 * 60 * 30, // 30 minutes
} as const;

/**
 * Cache time constants (garbage collection)
 * - Determines how long inactive data stays in cache
 */
export const CACHE_TIMES = {
  SHORT: 1000 * 60 * 5,   // 5 minutes
  MEDIUM: 1000 * 60 * 15, // 15 minutes
  LONG: 1000 * 60 * 30,   // 30 minutes
} as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIMES.STANDARD,
      gcTime: CACHE_TIMES.MEDIUM,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
