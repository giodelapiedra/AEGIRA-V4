---
name: form-component
description: Generate a React Hook Form + Zod form component for AEGIRA frontend. Use when creating forms with validation, working with form components, or implementing create/edit pages.
---
# Form Component

React Hook Form + Zod validated forms for AEGIRA. Forms are defined inline within page components.

## File Structure

```
aegira-frontend/src/features/<feature>/
├── pages/
│   ├── Admin<Feature>CreatePage.tsx    # Create form page
│   └── Admin<Feature>EditPage.tsx      # Edit form page (pre-filled)
└── hooks/
    └── use<Feature>s.ts                # Query + mutation hooks
```

**Note:** Forms are written inline inside the page component — NOT as separate presentational components.

## Form Pattern

<!-- BUILT FROM: .ai/patterns/frontend/form-pattern.md -->
# Form Pattern
> React Hook Form + Zod + mutateAsync pattern for create/edit pages

## When to Use
- Create pages (e.g., AdminWorkerCreatePage, AdminTeamCreatePage)
- Edit pages (e.g., AdminWorkerEditPage, AdminTeamEditPage)
- Any form that submits data to the backend API
- Settings forms, profile updates, inline edit forms

## Canonical Implementation

### Create Form Page

```typescript
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreatePerson } from '@/features/person/hooks/usePersons';
import { useTeams } from '@/features/team/hooks/useTeams';
import { useToast } from '@/lib/hooks/use-toast';
import { ROUTES } from '@/config/routes.config';

// 1. Schema defined OUTSIDE the component
const createWorkerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  role: z.enum(['WORKER', 'TEAM_LEAD', 'SUPERVISOR', 'WHS', 'ADMIN']),
  teamId: z.string().optional(),
});

// 2. Inferred type from schema
type CreateWorkerFormData = z.infer<typeof createWorkerSchema>;

export function AdminWorkerCreatePage() {
  const navigate = useNavigate();
  const createPerson = useCreatePerson();
  const { data: teamsData } = useTeams(1, 100);
  const { toast } = useToast();

  // 3. useForm with zodResolver
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkerFormData>({
    resolver: zodResolver(createWorkerSchema),
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      teamId: '',
      role: 'WORKER',
    },
  });

  // 4. onSubmit with mutateAsync + try/catch
  const onSubmit = async (data: CreateWorkerFormData) => {
    try {
      await createPerson.mutateAsync(data);
      toast({
        variant: 'success',
        title: 'Worker created',
        description: `${data.firstName} ${data.lastName} has been added successfully.`,
      });
      navigate(ROUTES.ADMIN_WORKERS);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to create worker',
        description: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      });
    }
  };

  const teams = teamsData?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Worker"
        description="Create a new worker account"
        action={
          <Button variant="outline" onClick={() => navigate(ROUTES.ADMIN_WORKERS)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Workers
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Worker Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Form fields in responsive grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="Enter first name"
                  {...register('firstName')}
                />
                {errors.firstName && (
                  <p className="text-sm text-destructive">{errors.firstName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Enter last name"
                  {...register('lastName')}
                />
                {errors.lastName && (
                  <p className="text-sm text-destructive">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            {/* Select fields use setValue + watch */}
            <div className="space-y-2">
              <Label htmlFor="teamId">Team</Label>
              <Select
                value={watch('teamId') || ''}
                onValueChange={(value) => setValue('teamId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.teamId && (
                <p className="text-sm text-destructive">{errors.teamId.message}</p>
              )}
            </div>

            {/* 5. Submit button disabled during submission */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(ROUTES.ADMIN_WORKERS)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || createPerson.isPending}>
                {createPerson.isPending ? 'Creating...' : 'Create Worker'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Edit Form Page (Pre-filled with Existing Data)

```typescript
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/PageLoader';
import { useTeam, useUpdateTeam } from '../hooks/useTeams';
import { useToast } from '@/lib/hooks/use-toast';
import { ROUTES } from '@/config/routes.config';

const updateTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100),
  description: z.string().optional(),
});

type UpdateTeamFormData = z.infer<typeof updateTeamSchema>;

export function AdminTeamEditPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: team, isLoading, error } = useTeam(teamId!);
  const updateTeam = useUpdateTeam();

  const form = useForm<UpdateTeamFormData>({
    resolver: zodResolver(updateTeamSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  // Pre-fill form when data loads
  useEffect(() => {
    if (team) {
      form.reset({
        name: team.name,
        description: team.description ?? '',
      });
    }
  }, [team, form]);

  const onSubmit = async (data: UpdateTeamFormData) => {
    try {
      await updateTeam.mutateAsync({ id: teamId!, input: data });
      toast({
        variant: 'success',
        title: 'Team updated',
        description: 'Team has been updated successfully.',
      });
      navigate(ROUTES.ADMIN_TEAMS);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update team',
        description: error instanceof Error ? error.message : 'Something went wrong.',
      });
    }
  };

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="form">
      <div className="space-y-6">
        <PageHeader title="Edit Team" description="Update team details" />
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Form fields */}
          <Button type="submit" disabled={form.formState.isSubmitting || updateTeam.isPending}>
            {updateTeam.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </div>
    </PageLoader>
  );
}
```

## Form Field Patterns

### Text Input
```typescript
<div className="space-y-2">
  <Label htmlFor="name">Name</Label>
  <Input id="name" placeholder="Enter name" {...register('name')} />
  {errors.name && (
    <p className="text-sm text-destructive">{errors.name.message}</p>
  )}
</div>
```

### Select (Controlled)
```typescript
<div className="space-y-2">
  <Label htmlFor="role">Role</Label>
  <Select value={watch('role')} onValueChange={(v) => setValue('role', v)}>
    <SelectTrigger>
      <SelectValue placeholder="Select role" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="WORKER">Worker</SelectItem>
      <SelectItem value="ADMIN">Admin</SelectItem>
    </SelectContent>
  </Select>
  {errors.role && (
    <p className="text-sm text-destructive">{errors.role.message}</p>
  )}
</div>
```

### Error Display
```typescript
// Always beneath the field, using text-sm text-destructive
{errors.fieldName && (
  <p className="text-sm text-destructive">{errors.fieldName.message}</p>
)}
```

## Rules

- ✅ **DO** define Zod schema OUTSIDE the component
- ✅ **DO** export inferred type: `type FormData = z.infer<typeof schema>`
- ✅ **DO** use `zodResolver(schema)` in `useForm`
- ✅ **DO** always provide `defaultValues`
- ✅ **DO** use `mutateAsync` with `try/catch` for form submissions
- ✅ **DO** show toast on both success AND error
- ✅ **DO** disable submit button during submission: `disabled={isSubmitting || mutation.isPending}`
- ✅ **DO** use `error instanceof Error ? error.message : 'fallback'` for error messages
- ✅ **DO** navigate to the list page on success
- ✅ **DO** use `form.reset()` to pre-fill edit forms when data loads
- ✅ **DO** use `setValue` + `watch` for controlled Select components
- ❌ **NEVER** use `mutate` with callbacks for form submissions (always `mutateAsync`)
- ❌ **NEVER** handle toast inside mutation hooks (handle in page component)
- ❌ **NEVER** define the Zod schema inside the component (causes re-creation on every render)
- ❌ **NEVER** skip error handling (always wrap `mutateAsync` in `try/catch`)
- ❌ **NEVER** show raw error objects to users (always provide fallback message)

## Common Mistakes

### WRONG: Using mutate instead of mutateAsync
```typescript
const onSubmit = (data: CreateTeamFormData) => {
  createTeam.mutate(data);         // WRONG - can't await, can't catch
  toast({ title: 'Team created' }); // WRONG - fires before mutation completes
  navigate('/teams');               // WRONG - navigates before mutation completes
};
```

### CORRECT: Using mutateAsync with try/catch
```typescript
const onSubmit = async (data: CreateTeamFormData) => {
  try {
    await createTeam.mutateAsync(data);
    toast({ variant: 'success', title: 'Team created' });
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

### WRONG: Schema inside component
```typescript
export function CreateTeamPage() {
  // WRONG - schema re-created on every render
  const schema = z.object({
    name: z.string().min(1),
  });

  const form = useForm({ resolver: zodResolver(schema) });
  // ...
}
```

### CORRECT: Schema outside component
```typescript
// CORRECT - schema defined once at module level
const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required'),
});

type CreateTeamForm = z.infer<typeof createTeamSchema>;

export function CreateTeamPage() {
  const form = useForm<CreateTeamForm>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: { name: '' },
  });
  // ...
}
```

### WRONG: Missing error handling
```typescript
const onSubmit = async (data: CreateTeamFormData) => {
  await createTeam.mutateAsync(data);  // WRONG - unhandled rejection if fails
  toast({ title: 'Team created' });
  navigate('/teams');
};
```

### CORRECT: Full error handling
```typescript
const onSubmit = async (data: CreateTeamFormData) => {
  try {
    await createTeam.mutateAsync(data);
    toast({ variant: 'success', title: 'Team created' });
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

### WRONG: Submit button not disabled during submission
```typescript
<Button type="submit">Create Team</Button>  {/* WRONG - allows double submit */}
```

### CORRECT: Disabled during submission
```typescript
<Button type="submit" disabled={isSubmitting || createTeam.isPending}>
  {createTeam.isPending ? 'Creating...' : 'Create Team'}
</Button>
```

### WRONG: Toast in mutation hook
```typescript
export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => apiClient.post(ENDPOINTS.TEAM.CREATE, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Team created');  // WRONG - toast belongs in page
    },
  });
}
```

### CORRECT: Toast in page component only
```typescript
// Hook - no toast
export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => apiClient.post(ENDPOINTS.TEAM.CREATE, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

// Page - toast here
const onSubmit = async (data: CreateTeamFormData) => {
  try {
    await createTeam.mutateAsync(data);
    toast({ variant: 'success', title: 'Team created' });
    navigate(ROUTES.ADMIN_TEAMS);
  } catch (error) {
    toast({ variant: 'destructive', title: 'Failed to create team' });
  }
};
```


## Mutation Usage in Forms

<!-- BUILT FROM: .ai/patterns/frontend/mutation-hooks.md -->
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

## Error Handling in Pages

Mutation errors are handled in the PAGE using `mutateAsync` + try/catch. The `ApiError` class provides structured error info.

```typescript
import { ApiError } from '@/lib/api/client';

const onSubmit = async (data: FormData) => {
  try {
    await createTeam.mutateAsync(data);
    toast({ title: 'Success', description: 'Team created successfully' });
    navigate(ROUTES.ADMIN_TEAMS);
  } catch (error) {
    // ApiError has .code and .statusCode for specific handling
    const message = error instanceof Error ? error.message : 'An error occurred';
    toast({ title: 'Error', description: message, variant: 'destructive' });
  }
};
```

### ApiError Type Narrowing
```typescript
// For specific error handling (e.g., duplicate detection):
catch (error) {
  if (error instanceof ApiError && error.code === 'DUPLICATE_CHECK_IN') {
    toast({ title: 'Already checked in', description: error.message, variant: 'destructive' });
  } else {
    toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed', variant: 'destructive' });
  }
}
```

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


## Checklist

- [ ] Zod schema defined OUTSIDE the component
- [ ] Exported inferred type: `type FormData = z.infer<typeof schema>`
- [ ] Uses `zodResolver(schema)` in `useForm`
- [ ] Provides `defaultValues` for create forms
- [ ] Uses `values` (not `defaultValues`) for edit forms with async data
- [ ] Uses `mutateAsync` + try/catch (NOT `mutate` with callbacks)
- [ ] Toasts on both success AND error
- [ ] Navigates using `ROUTES` constants
- [ ] Disables submit with `isSubmitting || mutation.isPending`
- [ ] Shows Cancel + Submit buttons at the bottom
- [ ] Shows field-level error messages below each field
- [ ] Uses `register` with `valueAsNumber: true` for number inputs
- [ ] Edit pages wrapped with `PageLoader skeleton="form"`
- [ ] Uses `setValue` + `watch` for shadcn Select/Switch (not `register`)
