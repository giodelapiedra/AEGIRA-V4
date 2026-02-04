---
description: State Management Rules for AEGIRA Frontend
globs: ["aegira-frontend/src/**/*.{ts,tsx}"]
alwaysApply: false
---
# State Management

AEGIRA has strict rules about which tool owns which state.

## State Ownership

| State Type    | Tool                | Examples                                    |
| ------------- | ------------------- | ------------------------------------------- |
| Server state  | TanStack Query v5   | API data, check-ins, persons, teams         |
| Client state  | Zustand             | User session, UI preferences                |
| Form state    | React Hook Form     | Form inputs, validation errors              |
| URL state     | React Router v6     | Route params, search params, filters        |

## TanStack Query (Server State)

ALL data from the API goes through React Query. Never cache API data in Zustand or useState.

```typescript
// Correct
const { data, isLoading } = useQuery({
  queryKey: ['check-ins'],
  queryFn: () => apiClient.get(ENDPOINTS.CHECK_IN.LIST),
  staleTime: STALE_TIMES.STANDARD,
});

// WRONG - never put API data in Zustand
const useStore = create((set) => ({
  checkIns: [],
  fetchCheckIns: async () => {
    const data = await apiClient.get('/check-ins');
    set({ checkIns: data }); // DON'T DO THIS
  },
}));
```

## Zustand (Client State Only)

Zustand is for the user session ONLY. There is no token in the store -- JWT is stored as an httpOnly cookie managed by the browser. Zustand only holds the deserialized user object.

```typescript
import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE' | null;
  dateOfBirth: string | null;
  profilePictureUrl: string | null;
  role: 'WORKER' | 'TEAM_LEAD' | 'SUPERVISOR' | 'ADMIN';
  companyId: string;
  companyName: string;
  companyTimezone: string;
}

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

**No `persist` middleware.** The session is validated on page load via a `/auth/session` API call. If the httpOnly cookie is valid, the backend returns the user object and the frontend calls `setAuth(user)`. If the cookie is expired/missing, the API client redirects to `/login`.

### Usage Patterns

```typescript
// In components - select specific slice
const user = useAuthStore((state) => state.user);

// In hooks (login) - set after successful auth
const setAuth = useAuthStore((state) => state.setAuth);
setAuth(response.user);

// In API client (401 handler) - clear on session expiry
useAuthStore.getState().clearAuth();

// Outside React (API client) - use getState()
useAuthStore.getState().setAuth(response.user);
```

## URL State (React Router)

Use route params and search params for filter/pagination state:

```typescript
const { id } = useParams();                   // Route param
const [searchParams, setSearchParams] = useSearchParams();
const page = Number(searchParams.get('page') ?? 1);
```

## Rules

- NEVER put server data in Zustand
- NEVER put server data in useState
- NEVER use useEffect for data fetching (use React Query)
- NEVER store tokens in Zustand or localStorage (JWT lives in httpOnly cookie)
- Zustand store: `auth.store.ts` (single store for user session)
- TanStack Query handles: caching, refetching, stale data, loading, errors
- API calls: `apiClient` + `ENDPOINTS` constants (dynamic endpoints are functions: `ENDPOINTS.PERSON.BY_ID(id)`)
- Query hooks: `useQuery` + `STALE_TIMES` (REALTIME 30s, STANDARD 2m, STATIC 10m, IMMUTABLE 30m)
- Mutations: `useMutation` + invalidate ALL affected query keys in `onSuccess`
- Pages: wrap in `<PageLoader isLoading error skeleton="type">` — never manual if/else
- Tables: `DataTable` from `@/components/ui/data-table` — never custom pagination
- Forms: React Hook Form + Zod (`zodResolver`) — never manual useState for form fields
- State: TanStack Query (server), Zustand (auth only), React Hook Form (forms)
- Page index: 0-indexed in frontend (`pageIndex`), 1-indexed in API (`page`)
- Types: import from `@/types/`, re-export from hooks
