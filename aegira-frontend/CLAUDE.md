# AEGIRA Frontend - Claude Code Rules

## Directory Structure
```
src/
├── App.tsx                           # ToastProvider + AppRoutes + Toaster
├── main.tsx                          # QueryClientProvider + BrowserRouter + App
├── config/                           # App configuration
│   ├── api.config.ts                 # API base URL + timeout
│   ├── query.config.ts               # TanStack Query client + stale/cache times
│   └── routes.config.ts              # ROUTES constant (all frontend paths)
├── types/                            # Shared TypeScript interfaces
│   ├── auth.types.ts
│   ├── check-in.types.ts
│   ├── team.types.ts
│   ├── person.types.ts
│   └── common.types.ts               # PaginatedResponse<T>, ApiResponse, BaseEntity
├── lib/
│   ├── api/
│   │   ├── client.ts                 # APIClient singleton (fetch wrapper)
│   │   └── endpoints.ts              # ENDPOINTS constant (all API routes)
│   ├── hooks/
│   │   ├── use-auth.ts               # Auth store selector + role helpers
│   │   └── use-toast.tsx             # Toast context provider + hook
│   └── utils/
│       ├── cn.ts                     # clsx + tailwind-merge
│       ├── date.utils.ts             # Luxon date formatting
│       └── format.utils.ts           # Number/percentage/readiness formatters
├── stores/
│   └── auth.store.ts                 # Zustand auth store (user state only)
├── routes/
│   ├── index.tsx                     # Lazy-loaded route definitions
│   └── RouteGuard.tsx                # Auth + role-based route protection
├── components/
│   ├── layout/                       # AppLayout, Sidebar, Header
│   ├── common/                       # PageHeader, PageLoader, EmptyState, ConfirmDialog, skeletons
│   └── ui/                           # shadcn/ui components (Button, Card, DataTable, etc.)
└── features/
    └── <feature>/
        ├── pages/                    # Route-level page components
        ├── components/               # Feature-specific components (optional)
        └── hooks/                    # TanStack Query hooks (queries + mutations)
```

## Before Writing Code
1. Check `components/ui/` for existing shadcn/ui components
2. Check `components/common/` for PageHeader, PageLoader, EmptyState, ConfirmDialog, skeletons
3. Check `lib/utils/` for cn, date utils, format utils
4. Check `lib/api/endpoints.ts` for existing API endpoints
5. Check `types/` for existing interfaces
6. Follow the same pattern as the nearest similar feature module

---

## State Management Rules

| Data Type | Tool | Location |
|-----------|------|----------|
| Server data (API responses) | TanStack Query | `features/<feature>/hooks/` |
| Auth state (current user) | Zustand | `stores/auth.store.ts` |
| Form state | React Hook Form + Zod | Inside page/component |
| URL state (params, search) | React Router | `useParams()`, `useSearchParams()` |

- NEVER use Zustand for server data
- NEVER use TanStack Query for client-only state
- NEVER use `useState` for data that comes from an API

---

## API Client Pattern

The `apiClient` singleton (`lib/api/client.ts`) handles:
- Automatic `credentials: 'include'` for httpOnly cookies
- Response unwrapping: returns `response.data` directly (not the `{ success, data }` wrapper)
- 401 handling: clears auth store + redirects to `/login` (except for auth endpoints)
- Timeout via AbortController
- FormData detection for file uploads

### Usage
```typescript
// Hooks receive unwrapped data directly
const data = await apiClient.get<Team>(ENDPOINTS.TEAM.BY_ID(teamId));
// data = { id, name, ... } — NOT { success: true, data: { id, name } }
```

### Endpoints
All API routes are defined in `lib/api/endpoints.ts`. ALWAYS use `ENDPOINTS` constants — never hardcode URLs.
```typescript
ENDPOINTS.AUTH.LOGIN            // '/auth/login'
ENDPOINTS.TEAM.BY_ID(id)       // `/teams/${id}`
ENDPOINTS.TEAM.MEMBERS(teamId) // `/teams/${teamId}/members`
```

---

## Query Hook Pattern

All query hooks live in `features/<feature>/hooks/`.

### Standard Query Hook
```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type { PaginatedResponse } from '@/types/common.types';
import type { Team } from '@/types/team.types';

// Re-export types for convenience
export type { Team };

export function useTeams(page = 1, limit = 20, search = '') {
  return useQuery({
    queryKey: ['teams', page, limit, search],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search) params.set('search', search);
      return apiClient.get<PaginatedResponse<Team>>(
        `${ENDPOINTS.TEAM.LIST}?${params.toString()}`
      );
    },
  });
}
```

### Single Entity Query Hook
```typescript
export function useTeam(teamId: string) {
  return useQuery({
    queryKey: ['team', teamId],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: () => apiClient.get<Team>(ENDPOINTS.TEAM.BY_ID(teamId)),
    enabled: !!teamId,  // ALWAYS guard with enabled when ID might be empty
  });
}
```

### Rules
- `queryKey` MUST include all parameters that affect the response (page, limit, search, filters, ID)
- ALWAYS use `STALE_TIMES` constants from `config/query.config.ts` (REALTIME=30s, STANDARD=2m, STATIC=10m, IMMUTABLE=30m)
- ALWAYS use `enabled: !!id` when the query depends on a dynamic ID
- Re-export types from hooks for convenience: `export type { Team }`
- Build query params with `URLSearchParams` — never concatenate strings manually

---

## Mutation Hook Pattern

### Standard Mutation Hook
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

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

### Mutation with Related Cache Invalidation
```typescript
export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, data }: { teamId: string; data: UpdateTeamData }) =>
      apiClient.patch<Team>(ENDPOINTS.TEAM.UPDATE(teamId), data),
    onSuccess: (_, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });       // List
      queryClient.invalidateQueries({ queryKey: ['team', teamId] }); // Detail
    },
  });
}
```

### Rules
- ALWAYS invalidate related queries in `onSuccess`
- Invalidate the LIST query (`['teams']`) when creating/updating/deleting
- Invalidate the DETAIL query (`['team', id]`) when updating a specific entity
- Invalidate RELATED queries when changes affect other entities (e.g., deleting a team invalidates `['persons']`)
- Toast notifications are handled in the PAGE component (inside the `onSuccess`/`onError` of the mutation call), NOT inside the hook

---

## Paginated Table Pattern (DataTable)

ALWAYS use `DataTable` from `@/components/ui/data-table` for list pages. NEVER build manual tables.

### Standard Table Page
```typescript
import { useState } from 'react';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/PageLoader';
import { useTeams, type Team } from '../hooks/useTeams';

// Define columns OUTSIDE the component
const columns: ColumnDef<Team>[] = [
  { accessorKey: 'name', header: 'Team Name' },
  { accessorKey: 'member_count', header: 'Members' },
  // ... more columns
];

export function TeamsPage() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const { data, isLoading, error } = useTeams(
    pagination.pageIndex + 1,  // API is 1-indexed, TanStack Table is 0-indexed
    pagination.pageSize
  );

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <PageHeader title="Teams" />
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        pageCount={data?.pagination?.totalPages}
        pagination={pagination}
        onPaginationChange={setPagination}
      />
    </PageLoader>
  );
}
```

### Rules
- Define `columns` as `const columns: ColumnDef<T>[]` OUTSIDE the component (prevents re-renders)
- Convert page index: `pagination.pageIndex + 1` (API is 1-indexed, table is 0-indexed)
- Pass `pageCount` from `data?.pagination?.totalPages`
- Use `data?.items ?? []` for the data prop (never pass undefined)
- Wrap with `PageLoader` for loading/error/skeleton states

---

## Form Pattern (React Hook Form + Zod)

### Standard Form Page
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/lib/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes.config';

const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100),
  leaderId: z.string().min(1, 'Team leader is required'),
  supervisorId: z.string().optional(),
  checkInStart: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  checkInEnd: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  workDays: z.array(z.string()).min(1, 'At least one work day required'),
});

type CreateTeamForm = z.infer<typeof createTeamSchema>;

export function AdminTeamCreatePage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const createTeam = useCreateTeam();

  const form = useForm<CreateTeamForm>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: {
      name: '',
      leaderId: '',
      checkInStart: '06:00',
      checkInEnd: '10:00',
      workDays: ['1', '2', '3', '4', '5'],
    },
  });

  const onSubmit = async (data: CreateTeamForm) => {
    try {
      await createTeam.mutateAsync(data);
      toast({ title: 'Success', description: 'Team created successfully' });
      navigate(ROUTES.ADMIN_TEAMS);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create team',
        variant: 'destructive',
      });
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Form fields here */}
    </form>
  );
}
```

### Rules
- Define Zod schema OUTSIDE the component
- Export inferred type: `type FormType = z.infer<typeof schema>`
- Use `zodResolver(schema)` in `useForm`
- ALWAYS provide `defaultValues`
- Use `mutateAsync` + try/catch for form submissions (not `mutate` with callbacks)
- Toast on success AND error — handle both
- Navigate to list page on success
- Use `form.formState.isSubmitting` to disable submit button during submission

---

## Page Structure Pattern

### List Page
```
PageLoader (loading/error/skeleton) →
  PageHeader (title + optional action button) →
    DataTable (columns + data + pagination)
```

### Detail/Profile Page
```
PageLoader →
  Info Card (always visible at top, never inside a tab)
    Left: avatar/identity
    Right: info sections
  Tabs (below info card)
    TabContent...
```

### Create/Edit Page
```
PageHeader (title + back button) →
  Card →
    Form (React Hook Form + Zod)
      Form sections in Cards
      Submit button at bottom
```

---

## Routing Pattern

### Route Protection
```typescript
// All authenticated users
<Route element={<RouteGuard />}>
  <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
</Route>

// Role-restricted
<Route element={<RouteGuard allowedRoles={['ADMIN']} />}>
  <Route path={ROUTES.ADMIN_TEAMS} element={<AdminTeamsPage />} />
</Route>
```

### Rules
- ALL pages are lazy-loaded with `React.lazy()` and wrapped in `<Suspense>`
- Use `ROUTES` constants from `config/routes.config.ts` — never hardcode paths
- Use `RouteGuard` with `allowedRoles` for role-restricted routes
- Catch-all route redirects to dashboard

---

## Component Rules

### Loading States
- ALWAYS wrap page content with `<PageLoader>` component
- Props: `isLoading`, `error`, `skeleton` (type: 'page' | 'table' | 'form' | 'detail' | 'dashboard' | 'cards' | 'check-in' | 'stats')
- PageLoader shows skeleton during loading, ErrorMessage on error, children when ready

### Common Components (check these FIRST before creating new ones)
- `PageHeader` — title + description + action button
- `PageLoader` — loading/error/skeleton wrapper
- `EmptyState` — no data message with icon
- `ErrorMessage` — error alert
- `LoadingSpinner` — spinner for inline loading
- `ConfirmDialog` — confirmation modal
- `RoleBadge` — role display badge

### UI Components (shadcn/ui)
- `Button`, `Card`, `Input`, `Label`, `Select`, `Switch`, `Slider`
- `Dialog`, `DropdownMenu`, `Sheet`, `Tabs`
- `DataTable`, `Table`, `Badge`, `Avatar`, `Progress`
- `Alert`, `Separator`, `Skeleton`

---

## Styling Rules
- Tailwind CSS only — NO inline styles, NO CSS modules
- Use `cn()` from `@/lib/utils/cn` for conditional classes
- Mobile-first responsive design
- Follow shadcn/ui patterns for component styling (CVA for variants)

## TypeScript Rules
- NO `any` types
- Explicit `interface` for all component props
- Strict mode enabled
- Define types in `src/types/` for shared types, or co-locate with hooks for feature-specific types
- Re-export types from hooks when other components need them
