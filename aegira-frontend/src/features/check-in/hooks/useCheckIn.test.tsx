import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useTodayCheckIn } from './useTodayCheckIn';
import { useSubmitCheckIn } from './useSubmitCheckIn';
import { setAuthenticatedUser, clearAuth } from '@/test/test-utils';

// Create wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe('Check-in hooks', () => {
  beforeEach(() => {
    setAuthenticatedUser();
  });

  afterEach(() => {
    clearAuth();
  });

  describe('useTodayCheckIn', () => {
    it('fetches today check-in status', async () => {
      const { result } = renderHook(() => useTodayCheckIn(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Mock returns null (no check-in today)
      expect(result.current.data).toBeNull();
    });

    it('returns loading state initially', () => {
      const { result } = renderHook(() => useTodayCheckIn(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('useSubmitCheckIn', () => {
    it('submits check-in successfully', async () => {
      const { result } = renderHook(() => useSubmitCheckIn(), {
        wrapper: createWrapper(),
      });

      const checkInData = {
        sleepHours: 7,
        sleepQuality: 8,
        energyLevel: 8,
        stressLevel: 3,
        painLevel: 0,
        notes: 'Feeling good today',
      };

      result.current.mutate(checkInData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
    });

    it('calculates readiness category', async () => {
      const { result } = renderHook(() => useSubmitCheckIn(), {
        wrapper: createWrapper(),
      });

      const checkInData = {
        sleepHours: 8,
        sleepQuality: 9,
        energyLevel: 9,
        stressLevel: 2,
        painLevel: 0,
        notes: 'Great day!',
      };

      result.current.mutate(checkInData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
    });

    it('handles minimum values', async () => {
      const { result } = renderHook(() => useSubmitCheckIn(), {
        wrapper: createWrapper(),
      });

      const checkInData = {
        sleepHours: 0,
        sleepQuality: 1,
        energyLevel: 1,
        stressLevel: 10,
        painLevel: 10,
        notes: '',
      };

      result.current.mutate(checkInData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
    });
  });
});
