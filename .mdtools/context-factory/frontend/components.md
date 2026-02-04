---
description: Component Patterns for AEGIRA Frontend
globs: ["aegira-frontend/src/**/*.tsx"]
alwaysApply: false
---
# Component Patterns

AEGIRA uses two component types: Smart (Pages) and Presentational.

## Smart Components (Pages)

Pages connect to data via React Query hooks and orchestrate the UI. All pages use `PageLoader` for loading/error states.

```typescript
import { useCheckInStatus } from './hooks/useCheckInStatus';
import { useSubmitCheckIn } from './hooks/useSubmitCheckIn';
import { CheckInForm } from './components/CheckInForm';
import { PageLoader } from '@/components/common/PageLoader';
import { PageHeader } from '@/components/common/PageHeader';

export function CheckInPage() {
  const { data: status, isLoading, error } = useCheckInStatus();
  const submitMutation = useSubmitCheckIn();

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="check-in">
      <div className="space-y-6">
        <PageHeader title="Daily Check-In" />
        <CheckInForm
          status={status}
          onSubmit={submitMutation.mutate}
          isSubmitting={submitMutation.isPending}
        />
      </div>
    </PageLoader>
  );
}
```

### PageLoader (Mandatory Wrapper)

Every page wraps its content in `PageLoader` instead of manual `if/else` checks:

```typescript
import { PageLoader } from '@/components/common/PageLoader';

// Skeleton types: 'page' | 'dashboard' | 'table' | 'form' | 'detail' | 'check-in' | 'stats'
<PageLoader isLoading={isLoading} error={error} skeleton="table">
  <YourContent />
</PageLoader>
```

## Presentational Components

Receive data via props. No data fetching. Reusable across features.

```typescript
interface CheckInFormProps {
  data: CheckIn;
  onSubmit: (values: FormData) => void;
}

export function CheckInForm({ data, onSubmit }: CheckInFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Check-In</CardTitle>
      </CardHeader>
      <CardContent>
        {/* form content */}
      </CardContent>
    </Card>
  );
}
```

## Component Template

```typescript
import { useState } from 'react';
import { useMyData } from './hooks/useMyData';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface MyComponentProps {
  id: string;
  onSuccess?: () => void;
}

export function MyComponent({ id, onSuccess }: MyComponentProps) {
  const { data, isLoading, error } = useMyData(id);
  const [localState, setLocalState] = useState(false);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <Card>
      <h2>{data.title}</h2>
      <Button onClick={() => setLocalState(!localState)}>Toggle</Button>
    </Card>
  );
}
```

## Conditional Classes

Use `cn()` utility for conditional Tailwind classes:

```typescript
import { cn } from '@/lib/utils';

<div className={cn(
  "base-classes",
  isActive && "active-classes",
  variant === 'primary' && "primary-classes"
)} />
```

## Import Order

```
1. React imports
2. External libraries
3. Internal components (@/components/...)
4. Internal hooks
5. Types
6. Utils
```

## Rules

- ALWAYS define explicit prop interfaces for all components
- ALWAYS handle loading and error states
- ALWAYS use Tailwind for styling (NO inline styles)
- ALWAYS use `cn()` for conditional classes
- ALWAYS make components responsive (mobile-first)
- NEVER use `useEffect` for data fetching (use React Query)
- NEVER mutate props
- NEVER put server data in component state
- API calls: `apiClient` + `ENDPOINTS` constants (dynamic endpoints are functions: `ENDPOINTS.PERSON.BY_ID(id)`)
- Query hooks: `useQuery` + `STALE_TIMES` (REALTIME 30s, STANDARD 2m, STATIC 10m, IMMUTABLE 30m)
- Mutations: `useMutation` + invalidate ALL affected query keys in `onSuccess`
- Pages: wrap in `<PageLoader isLoading error skeleton="type">` — never manual if/else
- Tables: `DataTable` from `@/components/ui/data-table` — never custom pagination
- Forms: React Hook Form + Zod (`zodResolver`) — never manual useState for form fields
- State: TanStack Query (server), Zustand (auth only), React Hook Form (forms)
- Page index: 0-indexed in frontend (`pageIndex`), 1-indexed in API (`page`)
- Types: import from `@/types/`, re-export from hooks
