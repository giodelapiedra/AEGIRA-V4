# Error Handling (Frontend)
> PageLoader for queries, mutateAsync+try/catch for mutations, toast for user feedback

## When to Use
- Every page that fetches data (query errors)
- Every form submission (mutation errors)
- API client error handling (401, timeouts)
- React component error boundaries (unexpected crashes)

## Canonical Implementation

### Layer 1: API Client (Global Error Handling)

The `apiClient` handles 401 errors globally by clearing auth and redirecting to login.

```typescript
// lib/api/client.ts - already built in
class APIClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      const response = await fetch(`${API_CONFIG.baseURL}${endpoint}`, {
        ...options,
        credentials: 'include',
      });

      // Global 401 handling (session expired)
      if (response.status === 401) {
        const isAuthEndpoint = AUTH_ENDPOINTS.some((e) => endpoint.includes(e));
        if (!isAuthEndpoint) {
          useAuthStore.getState().clearAuth();
          window.location.href = ROUTES.LOGIN;
          throw new Error('Session expired');
        }
      }

      // Parse error response body
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({
          error: { message: response.statusText },
        }));
        throw new Error(errorBody.error?.message || `Request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data; // Unwrap { success, data } wrapper
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      throw error;
    }
  }
}
```

**What this means for your code:**
- 401 errors on non-auth endpoints auto-redirect to login (no manual handling needed)
- Backend error messages are extracted from `{ error: { message } }` body
- Timeout errors get a user-friendly message
- All errors are thrown as `Error` objects with descriptive messages

### Layer 2: Page-Level Query Errors (PageLoader)

Use `PageLoader` to handle loading and error states for all page-level queries.

```typescript
import { PageLoader } from '@/components/common/PageLoader';
import { PageHeader } from '@/components/common/PageHeader';
import { useTeams } from '../hooks/useTeams';

export function TeamsPage() {
  const { data, isLoading, error } = useTeams(1, 20);

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <div className="space-y-6">
        <PageHeader title="Teams" />
        {/* Content renders only when data is loaded and no error */}
      </div>
    </PageLoader>
  );
}
```

PageLoader behavior:
- `isLoading === true` → Shows appropriate skeleton (table, dashboard, form, detail, etc.)
- `error !== null` → Shows `ErrorMessage` component with error message
- Otherwise → Renders `children`

### Layer 3: Mutation Errors (mutateAsync + try/catch + toast)

All form submissions use `mutateAsync` wrapped in `try/catch`, with toast for user feedback.

```typescript
import { useToast } from '@/lib/hooks/use-toast';
import { useCreateTeam } from '../hooks/useTeams';

export function AdminTeamCreatePage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const createTeam = useCreateTeam();

  const onSubmit = async (data: CreateTeamFormData) => {
    try {
      await createTeam.mutateAsync(data);

      // Success toast
      toast({
        variant: 'success',
        title: 'Team created',
        description: `${data.name} has been created successfully.`,
      });

      navigate(ROUTES.ADMIN_TEAMS);
    } catch (error) {
      // Error toast with safe message extraction
      toast({
        variant: 'destructive',
        title: 'Failed to create team',
        description: error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.',
      });
    }
  };
}
```

### Layer 4: React Error Boundaries (Unexpected Crashes)

For unexpected React rendering errors, use error boundaries at the route level.

```typescript
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

// In route definitions or layout
<ErrorBoundary fallback={<ErrorFallback />}>
  <AppRoutes />
</ErrorBoundary>
```

## Error Message Extraction

Always use type-safe error message extraction with a fallback.

```typescript
// Standard pattern for catching mutation errors
catch (error) {
  const message = error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';

  toast({
    variant: 'destructive',
    title: 'Operation failed',
    description: message,
  });
}
```

## Toast Variants

```typescript
// Success toast
toast({
  variant: 'success',
  title: 'Team created',
  description: 'The team has been created successfully.',
});

// Error toast
toast({
  variant: 'destructive',
  title: 'Failed to create team',
  description: error instanceof Error ? error.message : 'Something went wrong.',
});
```

## Error Handling Summary by Context

| Context | Error Source | Handling Pattern |
|---------|-------------|-----------------|
| **Page load** | Query fails | `PageLoader` shows `ErrorMessage` automatically |
| **Form submit** | Mutation fails | `mutateAsync` + `try/catch` + error `toast` |
| **401 response** | Session expired | `apiClient` auto-redirects to login |
| **Timeout** | Network issue | `apiClient` throws "Request timed out" error |
| **React crash** | Component error | `ErrorBoundary` catches and shows fallback |
| **Validation** | Invalid form data | React Hook Form + Zod shows inline field errors |

## Rules

### Query Error Handling
- ✅ **DO** use `PageLoader` for all page-level loading/error states
- ✅ **DO** pass the `error` from `useQuery` directly to `PageLoader`
- ✅ **DO** choose the correct skeleton type for the page (`table`, `dashboard`, `detail`, `form`)
- ❌ **NEVER** build custom loading/error UI (use PageLoader)
- ❌ **NEVER** check `if (isLoading) return <div>Loading...</div>` manually
- ❌ **NEVER** check `if (error) return <div>Error</div>` manually

### Mutation Error Handling
- ✅ **DO** use `mutateAsync` with `try/catch` for all form submissions
- ✅ **DO** show toast on both success AND error
- ✅ **DO** provide fallback error messages: `error instanceof Error ? error.message : 'fallback'`
- ✅ **DO** keep toast handling in the PAGE component (not in mutation hooks)
- ✅ **DO** disable the submit button during mutation: `disabled={isSubmitting || mutation.isPending}`
- ❌ **NEVER** use `mutate` with `onError` callback for forms (use `mutateAsync` + `try/catch`)
- ❌ **NEVER** swallow errors silently (always show toast or log)
- ❌ **NEVER** show raw error objects to users (`[Object object]`)
- ❌ **NEVER** show `undefined` to users (always have a fallback string)

### API Client Errors
- ✅ **DO** let the apiClient handle 401 redirects automatically
- ✅ **DO** rely on apiClient to extract backend error messages
- ❌ **NEVER** manually handle 401 in page components (apiClient does it)
- ❌ **NEVER** manually parse response bodies (apiClient unwraps `data.data`)

## Common Mistakes

### WRONG: Manual loading/error handling
```typescript
export function TeamsPage() {
  const { data, isLoading, error } = useTeams(1, 20);

  // WRONG - manual loading state
  if (isLoading) return <div>Loading...</div>;

  // WRONG - manual error state
  if (error) return <div>Error: {error.message}</div>;

  return <div>{/* content */}</div>;
}
```

### CORRECT: PageLoader handles everything
```typescript
export function TeamsPage() {
  const { data, isLoading, error } = useTeams(1, 20);

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <div className="space-y-6">
        {/* Content only renders when loaded and no error */}
      </div>
    </PageLoader>
  );
}
```

### WRONG: Using mutate with onError callback
```typescript
const onSubmit = (data: FormData) => {
  // WRONG - mutate with callbacks
  createTeam.mutate(data, {
    onSuccess: () => {
      toast({ title: 'Created' });
      navigate('/teams');
    },
    onError: (error) => {
      toast({ title: 'Failed', description: error.message });
    },
  });
};
```

### CORRECT: Using mutateAsync with try/catch
```typescript
const onSubmit = async (data: FormData) => {
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

### WRONG: Showing raw error or undefined
```typescript
catch (error) {
  // WRONG - shows "[object Object]" if error is not an Error instance
  toast({ title: 'Error', description: String(error) });
}

catch (error) {
  // WRONG - shows "undefined" if error has no message
  toast({ title: 'Error', description: (error as Error).message });
}
```

### CORRECT: Type-safe error extraction with fallback
```typescript
catch (error) {
  toast({
    variant: 'destructive',
    title: 'Failed to create team',
    description: error instanceof Error
      ? error.message
      : 'Something went wrong. Please try again.',
  });
}
```

### WRONG: Toast in mutation hook
```typescript
// hooks/useCreateTeam.ts
export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => apiClient.post(ENDPOINTS.TEAM.CREATE, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Team created');   // WRONG - toast in hook
    },
    onError: (error) => {
      toast.error(error.message);      // WRONG - toast in hook
    },
  });
}
```

### CORRECT: Toast in page only, hook only does invalidation
```typescript
// hooks/useCreateTeam.ts
export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => apiClient.post(ENDPOINTS.TEAM.CREATE, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      // NO toast here
    },
  });
}

// pages/AdminTeamCreatePage.tsx
const onSubmit = async (data: CreateTeamFormData) => {
  try {
    await createTeam.mutateAsync(data);
    toast({ variant: 'success', title: 'Team created' });  // Toast here
    navigate(ROUTES.ADMIN_TEAMS);
  } catch (error) {
    toast({ variant: 'destructive', title: 'Failed' });     // Toast here
  }
};
```

### WRONG: Swallowing errors silently
```typescript
const onSubmit = async (data: FormData) => {
  try {
    await createTeam.mutateAsync(data);
    navigate('/teams');
  } catch {
    // WRONG - error is silently swallowed, user has no idea what happened
  }
};
```

### CORRECT: Always inform the user
```typescript
const onSubmit = async (data: FormData) => {
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
