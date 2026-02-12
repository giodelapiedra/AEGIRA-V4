# Mutation Hooks Pattern
> TanStack Query mutations for write operations with proper invalidation and error handling

## When to Use
- Creating, updating, or deleting entities
- Any POST, PUT, PATCH, DELETE operation
- Operations that change server state requiring cache invalidation

## Canonical Implementation

### Create Mutation with List Invalidation
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { Team, CreateTeamInput } from '@/types';

export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTeamInput) => {
      return apiClient.post<Team>(ENDPOINTS.TEAM.CREATE, input);
    },
    onSuccess: () => {
      // Invalidate list queries to refetch with new item
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}
```

### Update Mutation with List AND Detail Invalidation
```typescript
export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateTeamInput }) => {
      return apiClient.put<Team>(ENDPOINTS.TEAM.UPDATE(id), input);
    },
    onSuccess: (data) => {
      // Invalidate both list and detail queries
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['team', data.id] });
    },
  });
}
```

### Delete Mutation with Cross-Entity Invalidation
```typescript
export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teamId: string) => {
      return apiClient.delete(ENDPOINTS.TEAM.DELETE(teamId));
    },
    onSuccess: (_, teamId) => {
      // Invalidate team queries
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });

      // Invalidate related entities that include team data
      queryClient.invalidateQueries({ queryKey: ['persons'] }); // Person has teamId
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }); // Dashboard shows team stats
    },
  });
}
```

## Invalidation Matrix

| Entity Modified | Invalidate These QueryKeys |
|----------------|----------------------------|
| **Team** (create/update/delete) | `['teams']`, `['team', id]`, `['persons']`, `['dashboard']` |
| **Person** (create/update/delete) | `['persons']`, `['person', id]`, `['teams']`, `['dashboard']`, `['check-ins']` |
| **CheckIn** (create/update/delete) | `['check-ins']`, `['check-in', id]`, `['person', personId]`, `['dashboard']`, `['analytics']` |
| **Incident** (create/update/delete) | `['incidents']`, `['incident', id]`, `['cases']`, `['dashboard']`, `['analytics']`, `['person', personId]` |
| **Case** (create/update) | `['cases']`, `['case', id]`, `['incident', incidentId]`, `['dashboard']` |
| **MissedCheckIn** (acknowledge/resolve) | `['missed-check-ins']`, `['dashboard']`, `['person', personId]`, `['team', teamId]` |
| **Notification** (mark read) | `['notifications']` |

## Rules

### Invalidation Rules
- ✅ **DO** invalidate list queries after create/update/delete: `queryClient.invalidateQueries({ queryKey: ['teams'] })`
- ✅ **DO** invalidate detail query after update: `queryClient.invalidateQueries({ queryKey: ['team', id] })`
- ✅ **DO** invalidate dashboard after any data change that affects metrics
- ✅ **DO** invalidate analytics after changes to historical data (check-ins, incidents)
- ✅ **DO** invalidate parent entity lists after child entity changes (e.g., `['teams']` when person changes team)
- ❌ **NEVER** forget to invalidate related queries (use Invalidation Matrix)
- ❌ **NEVER** invalidate queries unnecessarily (only invalidate what changed)

### Toast Handling
- ✅ **DO** show toast in the PAGE/COMPONENT, not in the hook
- ✅ **DO** use `mutateAsync` in form submission with try/catch
- ✅ **DO** catch errors and show error toast in the page
- ❌ **NEVER** call `toast()` inside the mutation hook
- ❌ **NEVER** handle navigation in the hook (do it in the page)

### Mutation Function Patterns
- ✅ **DO** use object parameter for update/delete: `{ id, input }`
- ✅ **DO** return full entity from mutation if needed: `apiClient.post<Team>(...)`
- ✅ **DO** use descriptive mutation function names: `useCreateTeam`, `useUpdateTeam`, `useDeleteTeam`
- ❌ **NEVER** use generic names like `useMutateTeam`
- ❌ **NEVER** combine multiple operations in one mutation hook

### Error Handling
- ✅ **DO** let errors bubble up to the page (use `mutateAsync` + try/catch)
- ✅ **DO** show user-friendly error messages in toast
- ✅ **DO** keep form buttons disabled during submission
- ❌ **NEVER** swallow errors silently
- ❌ **NEVER** use `onError` in mutation hook for toast (do it in page)

## Common Mistakes

### ❌ WRONG: Toast in mutation hook
```typescript
export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTeamInput) => {
      return apiClient.post<Team>(ENDPOINTS.TEAM.CREATE, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Team created successfully'); // WRONG - toast in hook
    },
    onError: (error) => {
      toast.error('Failed to create team'); // WRONG - toast in hook
    },
  });
}
```

### ✅ CORRECT: Toast in page component
```typescript
// Hook (no toast)
export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTeamInput) => {
      return apiClient.post<Team>(ENDPOINTS.TEAM.CREATE, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

// Page component (with toast)
export function CreateTeamPage() {
  const navigate = useNavigate();
  const { mutateAsync } = useCreateTeam();

  const onSubmit = async (data: CreateTeamInput) => {
    try {
      await mutateAsync(data);
      toast.success('Team created successfully'); // CORRECT - toast in page
      navigate('/teams');
    } catch (error) {
      toast.error('Failed to create team');
    }
  };

  return <TeamForm onSubmit={onSubmit} />;
}
```

### ❌ WRONG: Missing related query invalidation
```typescript
export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teamId: string) => {
      return apiClient.delete(ENDPOINTS.TEAM.DELETE(teamId));
    },
    onSuccess: () => {
      // WRONG - only invalidates teams, but persons and dashboard also show team data
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}
```

### ✅ CORRECT: Invalidate all related queries
```typescript
export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teamId: string) => {
      return apiClient.delete(ENDPOINTS.TEAM.DELETE(teamId));
    },
    onSuccess: (_, teamId) => {
      // CORRECT - invalidates all related queries per matrix
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['persons'] }); // Person has teamId
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }); // Dashboard shows team stats
    },
  });
}
```

### ❌ WRONG: Using mutate instead of mutateAsync in forms
```typescript
export function CreateTeamPage() {
  const navigate = useNavigate();
  const { mutate } = useCreateTeam(); // WRONG - can't await

  const onSubmit = (data: CreateTeamInput) => {
    mutate(data); // WRONG - can't catch errors, can't await navigation
    toast.success('Team created'); // WRONG - shows before mutation completes
    navigate('/teams'); // WRONG - navigates before mutation completes
  };

  return <TeamForm onSubmit={onSubmit} />;
}
```

### ✅ CORRECT: Using mutateAsync with try/catch
```typescript
export function CreateTeamPage() {
  const navigate = useNavigate();
  const { mutateAsync } = useCreateTeam(); // CORRECT - returns promise

  const onSubmit = async (data: CreateTeamInput) => {
    try {
      await mutateAsync(data); // CORRECT - await completion
      toast.success('Team created successfully');
      navigate('/teams'); // CORRECT - only navigate on success
    } catch (error) {
      toast.error('Failed to create team'); // CORRECT - catch errors
    }
  };

  return <TeamForm onSubmit={onSubmit} />;
}
```

### ❌ WRONG: Not invalidating detail query after update
```typescript
export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateTeamInput }) => {
      return apiClient.put<Team>(ENDPOINTS.TEAM.UPDATE(id), input);
    },
    onSuccess: () => {
      // WRONG - only invalidates list, detail page won't update
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}
```

### ✅ CORRECT: Invalidate both list and detail
```typescript
export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateTeamInput }) => {
      return apiClient.put<Team>(ENDPOINTS.TEAM.UPDATE(id), input);
    },
    onSuccess: (data) => {
      // CORRECT - invalidates both list and detail
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['team', data.id] });
    },
  });
}
```

### ❌ WRONG: Overly broad invalidation
```typescript
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      return apiClient.put(ENDPOINTS.NOTIFICATION.MARK_READ(notificationId));
    },
    onSuccess: () => {
      // WRONG - invalidates everything unnecessarily
      queryClient.invalidateQueries();
    },
  });
}
```

### ✅ CORRECT: Targeted invalidation
```typescript
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      return apiClient.put(ENDPOINTS.NOTIFICATION.MARK_READ(notificationId));
    },
    onSuccess: () => {
      // CORRECT - only invalidates notifications
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
```
