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

**Note:** Forms are written inline inside the page component — NOT as separate presentational components. This matches the actual codebase pattern.

## Create Page Template

```typescript
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateFeature } from '../hooks/useFeatures';
import { useToast } from '@/lib/hooks/use-toast';
import { ROUTES } from '@/config/routes.config';

// 1. Zod schema OUTSIDE the component
const createFeatureSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).trim(),
  description: z.string().max(500).optional(),
  email: z.string().email('Invalid email').toLowerCase().trim(),
  role: z.enum(['ADMIN', 'SUPERVISOR', 'TEAM_LEAD', 'WORKER']),
  teamId: z.string().min(1, 'Team is required'),
  notes: z.string().max(500).optional(),
});

// 2. Infer type from schema
type CreateFeatureFormData = z.infer<typeof createFeatureSchema>;

// 3. Page component with form inline
export function AdminFeatureCreatePage() {
  const navigate = useNavigate();
  const createFeature = useCreateFeature();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateFeatureFormData>({
    resolver: zodResolver(createFeatureSchema),
    defaultValues: {
      name: '',
      description: '',
      email: '',
      role: 'WORKER',
      teamId: '',
      notes: '',
    },
  });

  const selectedRole = watch('role');
  const selectedTeamId = watch('teamId');

  // 4. mutateAsync + try/catch for submissions
  const onSubmit = async (data: CreateFeatureFormData) => {
    try {
      await createFeature.mutateAsync({
        name: data.name,
        description: data.description,
        email: data.email,
        role: data.role,
        teamId: data.teamId || null,
        notes: data.notes,
      });
      toast({
        variant: 'success',
        title: 'Feature created',
        description: `${data.name} has been created successfully.`,
      });
      navigate(ROUTES.ADMIN_FEATURES);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to create feature',
        description: error instanceof Error ? error.message : 'Something went wrong.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <PageHeader
        title="Add Feature"
        description="Create a new feature"
        action={
          <Button variant="outline" onClick={() => navigate(ROUTES.ADMIN_FEATURES)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1: Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>Basic information about the feature</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Text input */}
            <div className="space-y-2">
              <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                placeholder="Enter name"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Textarea */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Enter description"
                rows={3}
                {...register('description')}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>

            {/* Email input */}
            <div className="space-y-2">
              <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Assignment */}
        <Card>
          <CardHeader>
            <CardTitle>Assignment</CardTitle>
            <CardDescription>Role and team assignment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Select (use setValue + watch for shadcn Select) */}
            <div className="space-y-2">
              <Label>Role <span className="text-destructive">*</span></Label>
              <Select
                value={selectedRole}
                onValueChange={(value) => setValue('role', value as CreateFeatureFormData['role'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WORKER">Worker</SelectItem>
                  <SelectItem value="TEAM_LEAD">Team Lead</SelectItem>
                  <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && (
                <p className="text-sm text-destructive">{errors.role.message}</p>
              )}
            </div>

            {/* Conditional field based on watched value */}
            {selectedRole === 'WORKER' && (
              <div className="space-y-2">
                <Label>Team <span className="text-destructive">*</span></Label>
                <Select
                  value={selectedTeamId || ''}
                  onValueChange={(value) => setValue('teamId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Populate from a query hook like useTeams() */}
                  </SelectContent>
                </Select>
                {errors.teamId && (
                  <p className="text-sm text-destructive">{errors.teamId.message}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions: Cancel + Submit */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(ROUTES.ADMIN_FEATURES)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || createFeature.isPending}>
            {createFeature.isPending ? 'Creating...' : 'Create Feature'}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

## Edit Page Template

```typescript
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/PageLoader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFeature, useUpdateFeature } from '../hooks/useFeatures';
import { useToast } from '@/lib/hooks/use-toast';
import { ROUTES } from '@/config/routes.config';

const updateFeatureSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).trim(),
  description: z.string().max(500).optional(),
});

type UpdateFeatureFormData = z.infer<typeof updateFeatureSchema>;

export function AdminFeatureEditPage() {
  const { featureId } = useParams();
  const navigate = useNavigate();
  const { data: feature, isLoading, error } = useFeature(featureId!);
  const updateFeature = useUpdateFeature();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateFeatureFormData>({
    resolver: zodResolver(updateFeatureSchema),
    // Pre-fill from fetched data (only works when feature is loaded)
    values: feature
      ? {
          name: feature.name,
          description: feature.description || '',
        }
      : undefined,
  });

  const onSubmit = async (data: UpdateFeatureFormData) => {
    try {
      await updateFeature.mutateAsync({
        featureId: featureId!,
        data,
      });
      toast({
        variant: 'success',
        title: 'Feature updated',
        description: `${data.name} has been updated successfully.`,
      });
      navigate(ROUTES.ADMIN_FEATURES);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update feature',
        description: error instanceof Error ? error.message : 'Something went wrong.',
      });
    }
  };

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="form">
      <div className="space-y-6">
        <PageHeader
          title="Edit Feature"
          action={
            <Button variant="outline" onClick={() => navigate(ROUTES.ADMIN_FEATURES)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          }
        />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...register('name')} />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" {...register('description')} />
                {errors.description && (
                  <p className="text-sm text-destructive">{errors.description.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(ROUTES.ADMIN_FEATURES)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || updateFeature.isPending}>
              {updateFeature.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </PageLoader>
  );
}
```

## Field Patterns Quick Reference

```typescript
// Text input
<Input id="name" placeholder="Enter name" {...register('name')} />

// Number input (use valueAsNumber)
<Input id="count" type="number" {...register('count', { valueAsNumber: true })} />

// Textarea
<Textarea id="notes" rows={3} {...register('notes')} />

// Select (shadcn — must use setValue + watch, not register)
<Select value={watch('role')} onValueChange={(v) => setValue('role', v as FormData['role'])}>

// Time input
<Input id="startTime" type="time" {...register('startTime')} />

// Optional field (empty string → null for API)
supervisorId: data.supervisorId || null,

// Conditional field
{watch('role') === 'WORKER' && <div>...</div>}
```

## Error Display Pattern

```typescript
{errors.fieldName && (
  <p className="text-sm text-destructive">{errors.fieldName.message}</p>
)}
```

## Key Rules

- ALWAYS define Zod schema OUTSIDE the component
- ALWAYS export inferred type: `type FormData = z.infer<typeof schema>`
- ALWAYS use `zodResolver(schema)` in `useForm`
- ALWAYS provide `defaultValues` for create forms
- ALWAYS use `values` (not `defaultValues`) for edit forms with async data
- ALWAYS use `mutateAsync` + try/catch — NOT `mutate` with callbacks
- ALWAYS toast on both success AND error using `toast({ variant, title, description })`
- ALWAYS navigate using `ROUTES` constants — never hardcode paths
- ALWAYS disable submit button with `isSubmitting || mutation.isPending`
- ALWAYS show Cancel + Submit buttons at the bottom
- ALWAYS show field-level error messages below each field
- ALWAYS use `register` with `valueAsNumber: true` for number inputs
- ALWAYS wrap edit pages with `PageLoader` using `skeleton="form"`
- Use `setValue` + `watch` for shadcn Select/Switch (not `register`)
- Organize forms into multiple Card sections for logical grouping
- Keep form inline within the page component — do NOT create separate form components
- NEVER manage form state manually with useState
