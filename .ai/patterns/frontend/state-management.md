# State Management
> 4 state layers: TanStack Query (server), Zustand (auth), React Hook Form (forms), React Router (URL)

## When to Use
- Deciding where to store and manage different types of state
- Setting up data fetching for a new feature
- Managing form state in create/edit pages
- Reading URL parameters for dynamic routes

## The 4 State Layers

| State Type | Tool | Location | Examples |
|-----------|------|----------|----------|
| **Server data** (API responses) | TanStack Query | `features/<feature>/hooks/` | Teams list, person detail, dashboard stats |
| **Auth state** (current user) | Zustand | `stores/auth.store.ts` | Logged-in user, role, company |
| **Form state** (input values) | React Hook Form + Zod | Inside page component | Create team form, edit worker form |
| **URL state** (params, search) | React Router | `useParams()`, `useSearchParams()` | Team ID, worker ID, page number |

## Canonical Implementation

### Layer 1: Server State (TanStack Query)

All data from the API goes through TanStack Query hooks.

```typescript
// features/team/hooks/useTeams.ts
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type { PaginatedResponse } from '@/types/common.types';
import type { Team } from '@/types/team.types';

export type { Team };

export function useTeams(page = 1, limit = 20, includeInactive = false, search = '') {
  return useQuery({
    queryKey: ['teams', page, limit, includeInactive, search],
    staleTime: STALE_TIMES.STANDARD,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        includeInactive: String(includeInactive),
      });
      if (search) params.set('search', search);
      return apiClient.get<PaginatedResponse<Team>>(
        `${ENDPOINTS.TEAM.LIST}?${params.toString()}`
      );
    },
  });
}
```

Usage in a page:
```typescript
export function TeamsPage() {
  const { data, isLoading, error } = useTeams(1, 20);
  const teams = data?.items ?? [];
  // Render teams...
}
```

### Layer 2: Auth State (Zustand)

Only the authenticated user's session is stored in Zustand.

```typescript
// stores/auth.store.ts
import { create } from 'zustand';
import type { User } from '@/types/auth.types';

export type { User };

interface AuthState {
  user: User | null;
  setAuth: (user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  setAuth: (user) => set({ user }),
  clearAuth: () => set({ user: null }),
}));
```

Usage in components:
```typescript
import { useAuthStore } from '@/stores/auth.store';

export function Header() {
  const user = useAuthStore((state) => state.user);
  return <span>{user?.first_name}</span>;
}
```

### Layer 3: Form State (React Hook Form + Zod)

Form state lives inside the component, managed by React Hook Form.

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required'),
  description: z.string().optional(),
});

type CreateTeamForm = z.infer<typeof createTeamSchema>;

export function AdminTeamCreatePage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateTeamForm>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: { name: '', description: '' },
  });

  const onSubmit = async (data: CreateTeamForm) => {
    // Submit to API via mutation hook...
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      {errors.name && <p>{errors.name.message}</p>}
    </form>
  );
}
```

### Layer 4: URL State (React Router)

Dynamic route parameters and URL-based state use React Router hooks.

```typescript
import { useParams, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes.config';
import { buildRoute } from '@/lib/utils/route.utils';

export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();

  // Use teamId in a query hook
  const { data: team } = useTeam(teamId!);

  // Navigate with buildRoute helper
  const goToWorker = (workerId: string) => {
    navigate(buildRoute(ROUTES.TEAM_WORKER_DETAIL, { workerId }));
  };

  return <div>{team?.name}</div>;
}
```

## Decision Flowchart

```
Does the data come from the backend API?
  YES → TanStack Query (useQuery / useMutation)
  NO  ↓

Is it the logged-in user's identity/role?
  YES → Zustand (useAuthStore)
  NO  ↓

Is it form input data (create/edit)?
  YES → React Hook Form + Zod
  NO  ↓

Is it a route parameter or URL state?
  YES → React Router (useParams, useSearchParams)
  NO  ↓

Is it simple local UI state (open/close, selected tab)?
  YES → useState
  NO  → Re-evaluate — likely one of the above
```

## Combining Layers (Common Patterns)

### Query + URL Params (Detail Page)
```typescript
export function PersonDetailPage() {
  // Layer 4: URL state
  const { personId } = useParams<{ personId: string }>();

  // Layer 1: Server state using URL param
  const { data: person, isLoading, error } = usePerson(personId!);

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="detail">
      <div>{person?.first_name}</div>
    </PageLoader>
  );
}
```

### Query + Form + Mutation (Edit Page)
```typescript
export function AdminTeamEditPage() {
  // Layer 4: URL state
  const { teamId } = useParams<{ teamId: string }>();

  // Layer 1: Server state (fetch existing data)
  const { data: team, isLoading } = useTeam(teamId!);

  // Layer 3: Form state (pre-filled from server data)
  const form = useForm<UpdateTeamForm>({
    resolver: zodResolver(updateTeamSchema),
    defaultValues: { name: '', description: '' },
  });

  // Pre-fill when data loads
  useEffect(() => {
    if (team) form.reset({ name: team.name, description: team.description ?? '' });
  }, [team]);

  // Layer 1: Mutation
  const updateTeam = useUpdateTeam();
  const onSubmit = async (data: UpdateTeamForm) => {
    await updateTeam.mutateAsync({ id: teamId!, input: data });
  };

  return (
    <PageLoader isLoading={isLoading} skeleton="form">
      <form onSubmit={form.handleSubmit(onSubmit)}>{/* fields */}</form>
    </PageLoader>
  );
}
```

### Auth + Query (Role-Dependent Data)
```typescript
export function Dashboard() {
  // Layer 2: Auth state for role
  const user = useAuthStore((state) => state.user);

  // Layer 1: Different query based on role
  if (user?.role === 'ADMIN') return <AdminDashboard />;
  if (user?.role === 'WHS') return <WhsDashboard />;
  if (user?.role === 'WORKER') return <WorkerDashboard />;
  return <TeamLeadDashboard />;
}
```

## Rules

### TanStack Query (Server State)
- ✅ **DO** use TanStack Query for ALL data from the backend API
- ✅ **DO** put query hooks in `features/<feature>/hooks/`
- ✅ **DO** use `STALE_TIMES` constants for cache control
- ✅ **DO** derive computed values from query data (never copy into useState)
- ❌ **NEVER** use `useState` for data that comes from an API
- ❌ **NEVER** use `useEffect` to fetch data (that is what useQuery is for)
- ❌ **NEVER** store API responses in Zustand

### Zustand (Auth State)
- ✅ **DO** use Zustand ONLY for auth state (current user session)
- ✅ **DO** use selector pattern: `useAuthStore((state) => state.user)`
- ❌ **NEVER** use Zustand for server data (teams, persons, incidents)
- ❌ **NEVER** create new Zustand stores for feature state
- ❌ **NEVER** put API response data into Zustand

### React Hook Form (Form State)
- ✅ **DO** use React Hook Form + Zod for all form pages
- ✅ **DO** define schemas outside components
- ✅ **DO** use `zodResolver` for validation
- ❌ **NEVER** manage form state with useState for controlled inputs
- ❌ **NEVER** put form state in Zustand or TanStack Query

### React Router (URL State)
- ✅ **DO** use `useParams()` for route parameters (IDs)
- ✅ **DO** use `useSearchParams()` for URL query parameters (if needed)
- ✅ **DO** use `ROUTES` constants and `buildRoute` for navigation
- ❌ **NEVER** hardcode route paths in navigate calls
- ❌ **NEVER** store URL-derivable state in useState

## Common Mistakes

### WRONG: useState for API data
```typescript
export function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // WRONG - manual data fetching with useEffect
  useEffect(() => {
    setLoading(true);
    fetch('/api/teams')
      .then((res) => res.json())
      .then((data) => setTeams(data))
      .finally(() => setLoading(false));
  }, []);
}
```

### CORRECT: TanStack Query for API data
```typescript
export function TeamsPage() {
  // CORRECT - TanStack Query handles loading, caching, refetching
  const { data, isLoading, error } = useTeams(1, 20);
  const teams = data?.items ?? [];
}
```

### WRONG: Zustand for server data
```typescript
// WRONG - storing team list in Zustand
const useTeamStore = create((set) => ({
  teams: [],
  setTeams: (teams) => set({ teams }),
  fetchTeams: async () => {
    const teams = await apiClient.get('/teams');
    set({ teams });
  },
}));
```

### CORRECT: TanStack Query for server data, Zustand for auth only
```typescript
// CORRECT - Zustand only for auth
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  setAuth: (user) => set({ user }),
  clearAuth: () => set({ user: null }),
}));

// CORRECT - TanStack Query for server data
export function useTeams(page: number, limit: number) {
  return useQuery({
    queryKey: ['teams', page, limit],
    queryFn: () => apiClient.get(ENDPOINTS.TEAM.LIST),
  });
}
```

### WRONG: Copying query data into useState
```typescript
export function TeamsPage() {
  const { data } = useTeams(1, 20);
  const [teams, setTeams] = useState<Team[]>([]);

  // WRONG - copying query data into local state
  useEffect(() => {
    if (data?.items) {
      setTeams(data.items);
    }
  }, [data]);
}
```

### CORRECT: Derive directly from query data
```typescript
export function TeamsPage() {
  const { data } = useTeams(1, 20);

  // CORRECT - derive directly, no intermediate state
  const teams = data?.items ?? [];
  const totalCount = data?.pagination?.total ?? 0;
  const activeTeams = teams.filter((t) => t.is_active);
}
```

### WRONG: useEffect to fetch data
```typescript
export function PersonDetailPage() {
  const { personId } = useParams();
  const [person, setPerson] = useState(null);

  // WRONG - manual fetch with useEffect
  useEffect(() => {
    apiClient.get(`/persons/${personId}`).then(setPerson);
  }, [personId]);
}
```

### CORRECT: Query hook with URL param
```typescript
export function PersonDetailPage() {
  const { personId } = useParams();

  // CORRECT - query hook handles fetching, caching, loading states
  const { data: person, isLoading, error } = usePerson(personId!);

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="detail">
      <div>{person?.first_name}</div>
    </PageLoader>
  );
}
```
