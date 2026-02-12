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
