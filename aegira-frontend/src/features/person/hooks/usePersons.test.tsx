import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { usePersons, usePerson, useCreatePerson, useUpdatePerson } from './usePersons';
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

describe('usePersons hooks', () => {
  beforeEach(() => {
    setAuthenticatedUser();
  });

  afterEach(() => {
    clearAuth();
  });

  describe('usePersons', () => {
    it('fetches persons list successfully', async () => {
      const { result } = renderHook(() => usePersons(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.items).toHaveLength(2);
      expect(result.current.data?.items[0].email).toBe('worker1@demo.com');
    });

    it('fetches persons with pagination', async () => {
      const { result } = renderHook(() => usePersons(1, 10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.pagination?.page).toBe(1);
      expect(result.current.data?.pagination?.limit).toBe(10);
    });

    it('filters inactive persons by default', async () => {
      const { result } = renderHook(() => usePersons(1, 20, false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const allActive = result.current.data?.items.every((p) => p.is_active);
      expect(allActive).toBe(true);
    });
  });

  describe('usePerson', () => {
    it('fetches single person by ID', async () => {
      const { result } = renderHook(() => usePerson('person-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.id).toBe('person-1');
      expect(result.current.data?.first_name).toBe('John');
    });

    it('returns error for non-existent person', async () => {
      const { result } = renderHook(() => usePerson('non-existent'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('does not fetch when personId is empty', async () => {
      const { result } = renderHook(() => usePerson(''), {
        wrapper: createWrapper(),
      });

      // Query should be disabled
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useCreatePerson', () => {
    it('creates a new person successfully', async () => {
      const { result } = renderHook(() => useCreatePerson(), {
        wrapper: createWrapper(),
      });

      const newPerson = {
        email: 'newworker@demo.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'Worker',
        role: 'WORKER' as const,
      };

      result.current.mutate(newPerson);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.email).toBe('newworker@demo.com');
      expect(result.current.data?.first_name).toBe('New');
    });
  });

  describe('useUpdatePerson', () => {
    it('updates a person successfully', async () => {
      const { result } = renderHook(() => useUpdatePerson(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        personId: 'person-1',
        data: {
          firstName: 'Updated',
          lastName: 'Name',
        },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.first_name).toBe('Updated');
      expect(result.current.data?.last_name).toBe('Name');
    });

    it('can deactivate a person', async () => {
      const { result } = renderHook(() => useUpdatePerson(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        personId: 'person-1',
        data: {
          isActive: false,
        },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.is_active).toBe(false);
    });
  });
});
