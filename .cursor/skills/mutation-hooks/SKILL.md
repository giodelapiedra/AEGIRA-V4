---
name: mutation-hooks
description: Generate TanStack Query mutation hooks for AEGIRA frontend. Use when creating useMutation hooks for create/update/delete operations, form submissions, or auth actions.
---
# Mutation Hooks (Write Operations)

TanStack Query v5 mutation hooks for AEGIRA. Uses `apiClient` + `ENDPOINTS`, invalidates all affected queries on success.

## File Location & Naming

Mutations share a file with query hooks for the same entity:

```
aegira-frontend/src/features/<feature>/hooks/
├── useTeams.ts              # useTeams + useCreateTeam + useUpdateTeam + useDeleteTeam (grouped)
├── usePersons.ts            # usePersons + useCreatePerson + useUpdatePerson (grouped)
├── useSubmitCheckIn.ts      # Standalone mutation (complex transform)
├── useLogin.ts              # Auth mutation
```

## Required Imports

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
```

## 1. Create Mutation

```typescript
/**
 * Create a new team
 */
export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTeamData) =>
      apiClient.post<Team>(ENDPOINTS.TEAM.CREATE, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}
```

## 2. Update Mutation (with specific entity invalidation)

```typescript
/**
 * Update a team
 */
export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, data }: { teamId: string; data: UpdateTeamData }) =>
      apiClient.patch<Team>(ENDPOINTS.TEAM.UPDATE(teamId), data),
    onSuccess: (_, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });          // List
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });   // Detail
      queryClient.invalidateQueries({ queryKey: ['team', 'my-members'] }); // Related
    },
  });
}
```

**Note:** Use `{ entityId, data }` object param so `onSuccess` can access the ID from `variables`.

## 3. Delete Mutation

```typescript
/**
 * Delete a team
 */
export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teamId: string) =>
      apiClient.delete(ENDPOINTS.TEAM.DETAIL(teamId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['persons'] });   // Related
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }); // Related
    },
  });
}
```

## 4. Submit Mutation (with data transformation)

Use transformation only when the backend expects a different field shape:

```typescript
function transformToBackendFormat(data: CheckInSubmission) {
  const physicalCondition = Math.max(1, Math.min(10, 11 - data.fatigueLevel));
  return {
    hoursSlept: data.sleepHours,
    sleepQuality: data.sleepQuality,
    physicalCondition,
    stressLevel: data.stressLevel,
    mood: data.mood,
    notes: data.notes,
  };
}

/**
 * Submit a check-in
 */
export function useSubmitCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CheckInSubmission) =>
      apiClient.post<CheckIn>(
        ENDPOINTS.CHECK_IN.SUBMIT,
        transformToBackendFormat(data)
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['check-ins'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['team', 'check-in-history'] });
      queryClient.invalidateQueries({ queryKey: ['worker-check-ins'] });
    },
  });
}
```

## 5. Auth Mutation (sets Zustand + pre-seeds cache)

```typescript
import { useAuthStore } from '@/stores/auth.store';

/**
 * Login and seed auth state
 */
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
queryClient.invalidateQueries({ queryKey: ['persons'] });                    // List
queryClient.invalidateQueries({ queryKey: ['person', personId] });           // Detail
queryClient.invalidateQueries({ queryKey: ['person', personId, 'stats'] });  // Stats

// Team CRUD affects:
queryClient.invalidateQueries({ queryKey: ['teams'] });       // List
queryClient.invalidateQueries({ queryKey: ['team', teamId] }); // Detail
queryClient.invalidateQueries({ queryKey: ['persons'] });      // Related
queryClient.invalidateQueries({ queryKey: ['dashboard'] });    // Related
```

## Usage in Components (mutateAsync + try/catch)

Side effects (toasts, navigation) go in the page component, NOT the hook.
Use `mutateAsync` + try/catch — NOT `mutate` with callbacks:

```typescript
const { toast } = useToast();
const navigate = useNavigate();
const createTeam = useCreateTeam();

const onSubmit = async (data: CreateTeamFormData) => {
  try {
    await createTeam.mutateAsync(data);
    toast({
      variant: 'success',
      title: 'Team created',
      description: `${data.name} has been created successfully.`,
    });
    navigate(ROUTES.ADMIN_TEAMS);
  } catch (error) {
    toast({
      variant: 'destructive',
      title: 'Failed to create team',
      description: error instanceof Error ? error.message : 'Something went wrong.',
    });
  }
};
```

## Key Rules

- ALWAYS use `apiClient` from `@/lib/api/client` (NOT raw fetch)
- ALWAYS use `ENDPOINTS` constants — dynamic ones are functions: `ENDPOINTS.TEAM.UPDATE(id)`
- ALWAYS get `queryClient` via `useQueryClient()`
- ALWAYS invalidate list query after create/update/delete
- ALWAYS invalidate detail query (`['entity', id]`) after update
- ALWAYS invalidate related queries when changes affect other entities (e.g., delete team → invalidate persons)
- ALWAYS use `mutateAsync` + try/catch in form submissions (NOT `mutate` with callbacks)
- ALWAYS toast on both success AND error using `toast({ variant, title, description })`
- Transform data before sending only when the backend expects a different field shape — most mutations send data as-is
- Group query + mutation hooks in one file per entity
- Keep side effects (toasts, navigation) in page components — hooks only handle cache invalidation
