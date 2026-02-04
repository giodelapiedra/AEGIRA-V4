import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useTeams, useTeam, useCreateTeam, useUpdateTeam } from './useTeams';
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

describe('useTeams hooks', () => {
  beforeEach(() => {
    setAuthenticatedUser();
  });

  afterEach(() => {
    clearAuth();
  });

  describe('useTeams', () => {
    it('fetches teams list successfully', async () => {
      const { result } = renderHook(() => useTeams(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.items).toHaveLength(2);
      expect(result.current.data?.items[0].name).toBe('Team Alpha');
    });

    it('includes member count in response', async () => {
      const { result } = renderHook(() => useTeams(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.items[0]._count?.members).toBe(5);
    });

    it('fetches teams with pagination', async () => {
      const { result } = renderHook(() => useTeams(1, 10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.pagination?.page).toBe(1);
      expect(result.current.data?.pagination?.limit).toBe(10);
    });
  });

  describe('useTeam', () => {
    it('fetches single team by ID', async () => {
      const { result } = renderHook(() => useTeam('team-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.id).toBe('team-1');
      expect(result.current.data?.name).toBe('Team Alpha');
    });

    it('returns error for non-existent team', async () => {
      const { result } = renderHook(() => useTeam('non-existent'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('does not fetch when teamId is empty', async () => {
      const { result } = renderHook(() => useTeam(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useCreateTeam', () => {
    it('creates a new team successfully', async () => {
      const { result } = renderHook(() => useCreateTeam(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        name: 'New Team',
        description: 'A new test team',
        leaderId: 'test-supervisor-id',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.name).toBe('New Team');
      expect(result.current.data?.description).toBe('A new test team');
      expect(result.current.data?.is_active).toBe(true);
    });

    it('creates team without description', async () => {
      const { result } = renderHook(() => useCreateTeam(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        name: 'Minimal Team',
        leaderId: 'test-supervisor-id',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.name).toBe('Minimal Team');
    });
  });

  describe('useUpdateTeam', () => {
    it('updates a team successfully', async () => {
      const { result } = renderHook(() => useUpdateTeam(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        teamId: 'team-1',
        data: {
          name: 'Updated Team Name',
          description: 'Updated description',
        },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.name).toBe('Updated Team Name');
      expect(result.current.data?.description).toBe('Updated description');
    });

    it('can deactivate a team', async () => {
      const { result } = renderHook(() => useUpdateTeam(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        teamId: 'team-1',
        data: {
          isActive: false,
        },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.is_active).toBe(false);
    });

    it('returns error for non-existent team', async () => {
      const { result } = renderHook(() => useUpdateTeam(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        teamId: 'non-existent',
        data: { name: 'New Name' },
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });
});
