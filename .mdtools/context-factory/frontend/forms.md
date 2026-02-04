---
description: Form Patterns for AEGIRA Frontend (React Hook Form + Zod)
globs: ["aegira-frontend/src/**/*.tsx"]
alwaysApply: false
---
# Form Component

React Hook Form + Zod validated form for AEGIRA.

## File Structure

```
aegira-frontend/src/features/<feature>/
├── components/
│   └── <Feature>Form.tsx          # Presentational form component
├── pages/
│   └── Create<Feature>Page.tsx    # Smart page that wires form + mutation
```

## 1. Form Component (Presentational)

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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

// 1. Zod schema
const featureSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).trim(),
  email: z.string().email('Invalid email').toLowerCase().trim(),
  role: z.enum(['ADMIN', 'SUPERVISOR', 'TEAM_LEAD', 'WORKER']),
  notes: z.string().max(500).optional(),
});

// 2. Infer type from schema
type FeatureFormData = z.infer<typeof featureSchema>;

// 3. Props interface
interface FeatureFormProps {
  onSubmit: (data: FeatureFormData) => void;
  isSubmitting?: boolean;
  defaultValues?: Partial<FeatureFormData>;
}

// 4. Form component
export function FeatureForm({ onSubmit, isSubmitting, defaultValues }: FeatureFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FeatureFormData>({
    resolver: zodResolver(featureSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Text input */}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          placeholder="Enter name"
          {...register('name')}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Email input */}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
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

      {/* Select (use setValue + watch for shadcn Select) */}
      <div className="space-y-2">
        <Label>Role</Label>
        <Select
          value={watch('role')}
          onValueChange={(value) => setValue('role', value as FeatureFormData['role'])}
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

      {/* Optional textarea */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input
          id="notes"
          placeholder="Additional notes..."
          {...register('notes')}
        />
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Saving...' : 'Save'}
      </Button>
    </form>
  );
}
```

## 2. Create Page (Smart Component)

```typescript
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { FeatureForm } from '../components/FeatureForm';
import { useCreateFeature } from '../hooks/useFeatures';

export function CreateFeaturePage() {
  const navigate = useNavigate();
  const mutation = useCreateFeature();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Feature"
        action={
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <FeatureForm
            onSubmit={(data) =>
              mutation.mutate(data, {
                onSuccess: () => navigate('/features'),
              })
            }
            isSubmitting={mutation.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

## 3. Edit Page (Pre-filled)

```typescript
export function EditFeaturePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: feature, isLoading, error } = useFeature(id!);
  const mutation = useUpdateFeature();

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="form">
      <div className="space-y-6">
        <PageHeader title="Edit Feature" />
        <Card>
          <CardContent className="pt-6">
            <FeatureForm
              defaultValues={feature}
              onSubmit={(data) =>
                mutation.mutate({ id: id!, ...data }, {
                  onSuccess: () => navigate(`/features/${id}`),
                })
              }
              isSubmitting={mutation.isPending}
            />
          </CardContent>
        </Card>
      </div>
    </PageLoader>
  );
}
```

## Key Rules

- ALWAYS use `zodResolver` for validation
- ALWAYS infer types from Zod schema (`z.infer<typeof schema>`)
- ALWAYS use `register` with `valueAsNumber: true` for number inputs
- ALWAYS show field-level error messages
- ALWAYS disable submit button during submission
- ALWAYS pass `defaultValues` for edit forms
- Use `setValue` + `watch` for shadcn Select/Switch components
- Keep side effects (toast, navigate) in the page, NOT the form
- NEVER manage form state manually with useState
