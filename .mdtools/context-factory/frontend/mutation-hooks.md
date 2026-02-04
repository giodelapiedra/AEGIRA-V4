---
description: TanStack Query Write Hook Patterns for AEGIRA Frontend
globs: ["aegira-frontend/src/**/hooks/**/*.ts"]
alwaysApply: false
---
# Mutation Hooks (Write Operations)

TanStack Query v5 mutation hooks for AEGIRA. Uses `apiClient` + `ENDPOINTS`, invalidates all affected queries on success.

## File Location & Naming

Mutations share a file with query hooks for the same entity:

```
aegira-frontend/src/features/<feature>/hooks/
├── usePersons.ts         # usePersons + useCreatePerson + useUpdatePerson (grouped)
├── useSubmitCheckIn.ts   # Standalone mutation (complex transform)
├── useLogin.ts           # Auth mutation
```

## Required Imports

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
```

## 1. Create Mutation

```typescript
export function useCreatePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePersonData) =>
      apiClient.post<Person>(ENDPOINTS.PERSON.CREATE, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
    },
  });
}
```

## 2. Update Mutation (with specific entity invalidation)

```typescript
export function useUpdatePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ personId, data }: { personId: string; data: UpdatePersonData }) =>
      apiClient.patch<Person>(ENDPOINTS.PERSON.UPDATE(personId), data),
    onSuccess: (_, { personId }) => {
      // Invalidate list AND specific entity + related data
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      queryClient.invalidateQueries({ queryKey: ['person', personId] });
      queryClient.invalidateQueries({ queryKey: ['person', personId, 'stats'] });
    },
  });
}
```

**Note:** Dynamic ENDPOINTS are functions: `ENDPOINTS.PERSON.UPDATE(personId)` returns `/persons/${personId}`.

## 3. Submit Mutation (with data transformation)

```typescript
export function useSubmitCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CheckInSubmission) =>
      apiClient.post<CheckIn>(
        ENDPOINTS.CHECK_IN.SUBMIT,
        transformToBackendFormat(data)  // camelCase → snake_case
      ),
    onSuccess: () => {
      // Invalidate ALL related queries
      queryClient.invalidateQueries({ queryKey: ['check-ins'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['team', 'check-in-history'] });
      queryClient.invalidateQueries({ queryKey: ['worker-check-ins'] });
    },
  });
}
```

## 4. Auth Mutation (sets Zustand + pre-seeds cache)

```typescript
import { useAuthStore } from '@/stores/auth.store';

export function useLogin() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginCredentials) =>
      apiClient.post<AuthResponse>(ENDPOINTS.AUTH.LOGIN, data),
    onSuccess: (response) => {
      setAuth(response.user);
      // Pre-seed session cache so RouteGuard doesn't show spinner
      queryClient.setQueryData(['auth', 'session'], response);
    },
  });
}
```

## Multi-Query Invalidation Reference

```typescript
// Check-in affects:
queryClient.invalidateQueries({ queryKey: ['check-ins'] });
queryClient.invalidateQueries({ queryKey: ['dashboard'] });
queryClient.invalidateQueries({ queryKey: ['team', 'check-in-history'] });
queryClient.invalidateQueries({ queryKey: ['worker-check-ins'] });

// Person CRUD affects:
queryClient.invalidateQueries({ queryKey: ['persons'] });       // List
queryClient.invalidateQueries({ queryKey: ['person', personId] }); // Detail
queryClient.invalidateQueries({ queryKey: ['person', personId, 'stats'] }); // Stats

// Team CRUD affects:
queryClient.invalidateQueries({ queryKey: ['teams'] });
queryClient.invalidateQueries({ queryKey: ['persons'] });
```

## Usage in Components

Side effects (toasts, navigation) go in the component, NOT the hook:

```typescript
const mutation = useCreatePerson();

mutation.mutate(data, {
  onSuccess: () => {
    toast.success('Person created');
    navigate('/persons');
  },
});
```

## Key Rules

- ALWAYS use `apiClient` from `@/lib/api/client` (NOT raw fetch)
- ALWAYS use `ENDPOINTS` constants — dynamic ones are functions: `ENDPOINTS.PERSON.UPDATE(id)`
- ALWAYS get `queryClient` via `useQueryClient()`
- ALWAYS invalidate list AND specific entity queries in update mutations
- ALWAYS transform camelCase → snake_case before sending to backend
- Group query + mutation hooks in one file per entity
- Keep side effects (toasts, navigation) in components via `mutate(data, { onSuccess })`
