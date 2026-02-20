# Query Hooks Pattern
> TanStack Query hooks for data fetching with proper stale time, pagination, and query key management

## When to Use
- Reading data from the backend (list, detail, dashboard, analytics)
- Any GET endpoint that needs caching, background refetch, or loading states
- Paginated lists with search/filter params
- Dashboard widgets with real-time updates
- Analytics pages with historical data

## Canonical Implementation

### Standard Paginated List Query
```typescript
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type { PaginatedResponse, Team } from '@/types';

export function useTeams(
  page = 1,
  limit = 20,
  includeInactive = false,
  search = ''
) {
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

### Single Entity Query with Enabled Guard
```typescript
export function useTeam(teamId: string | undefined) {
  return useQuery({
    queryKey: ['team', teamId],
    staleTime: STALE_TIMES.STANDARD,
    enabled: !!teamId, // Only fetch when teamId exists
    queryFn: async () => {
      if (!teamId) throw new Error('Team ID is required');
      return apiClient.get<Team>(ENDPOINTS.TEAM.DETAIL(teamId));
    },
  });
}
```

### Dashboard Query (REALTIME stale time)
```typescript
export function useWhsDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'whs'],
    staleTime: STALE_TIMES.REALTIME, // 30 seconds - frequent updates
    queryFn: async () => {
      return apiClient.get<WhsDashboardStats>(
        ENDPOINTS.DASHBOARD.WHS_DASHBOARD
      );
    },
  });
}
```

### Analytics Query with keepPreviousData
```typescript
export function useIncidentTrends(period: '7d' | '30d' | '90d') {
  return useQuery({
    queryKey: ['analytics', 'incident-trends', period],
    staleTime: STALE_TIMES.STATIC, // 10 minutes - historical data
    placeholderData: keepPreviousData, // Keep old data during period change
    queryFn: async () => {
      return apiClient.get<IncidentTrendData>(
        `${ENDPOINTS.ANALYTICS.INCIDENT_TRENDS}?period=${period}`
      );
    },
  });
}
```

## Stale Time Constants Reference

```typescript
// From @/config/query.config.ts
export const STALE_TIMES = {
  REALTIME: 30_000,    // 30s  - Dashboards, live metrics
  STANDARD: 120_000,   // 2m   - Standard lists, detail pages
  STATIC: 600_000,     // 10m  - Analytics, historical data, dropdowns
  IMMUTABLE: 1_800_000 // 30m  - Static reference data (holidays, etc.)
} as const;
```

## Rules

### Query Keys
- ✅ **DO** include ALL query parameters in queryKey (page, limit, search, filters, etc.)
- ✅ **DO** use plain strings, numbers, booleans only (no objects/arrays)
- ✅ **DO** follow pattern: `[entity, ...params]` e.g., `['teams', page, limit, search]`
- ✅ **DO** use enabled guard for conditional queries (`enabled: !!id`)
- ❌ **NEVER** put objects in queryKey: `['teams', { page, limit }]` is WRONG
- ❌ **NEVER** omit filter params from queryKey (breaks cache invalidation)

### Stale Time Selection
- ✅ **DO** use `REALTIME` (30s) for dashboards with live metrics
- ✅ **DO** use `STANDARD` (2m) for regular lists and detail pages
- ✅ **DO** use `STATIC` (10m) for analytics and historical data
- ✅ **DO** use `IMMUTABLE` (30m) for static reference data (holidays, roles)
- ❌ **NEVER** hardcode stale time values directly
- ❌ **NEVER** use staleTime: 0 (defeats caching purpose)

### Pagination & Search
- ✅ **DO** use `keepPreviousData` for paginated queries (smooth transitions)
- ✅ **DO** use `URLSearchParams` to build query strings
- ✅ **DO** conditionally add search params: `if (search) params.set('search', search)`
- ✅ **DO** convert all params to strings: `page: String(page)`
- ❌ **NEVER** manually build query strings: `?page=${page}&limit=${limit}`
- ❌ **NEVER** forget to include search/filter params in queryKey

### Return Types
- ✅ **DO** specify generic type: `apiClient.get<Team>(url)`
- ✅ **DO** use `PaginatedResponse<T>` for list queries
- ✅ **DO** return the entire `useQuery` result (includes `data`, `isLoading`, `error`, etc.)
- ❌ **NEVER** return only `data` from the hook
- ❌ **NEVER** use `any` types

## Error Handling

The `apiClient` throws `ApiError` on non-2xx responses. Query hooks let errors bubble to `PageLoader`.

```typescript
import { ApiError } from '@/lib/api/client';

// In pages — PageLoader handles query errors automatically:
const { data, isLoading, error } = useTeams(page, limit);
return (
  <PageLoader isLoading={isLoading} error={error} skeleton="table">
    {/* PageLoader shows ErrorMessage when error is truthy */}
  </PageLoader>
);
```

### ApiError Structure
```typescript
class ApiError extends Error {
  readonly code: string;       // 'NOT_FOUND', 'VALIDATION_ERROR', etc.
  readonly statusCode: number; // 404, 400, etc.
}
// 401 handling: apiClient clears auth store + redirects to login (except auth endpoints)
// Timeout: throws ApiError with code 'TIMEOUT', statusCode 408
```

### When to Use retry
```typescript
// Session check — never retry (prevents infinite loop on expired session)
useQuery({ queryKey: ['auth', 'session'], retry: false });

// Regular data queries — use default retry (3 attempts with backoff)
useQuery({ queryKey: ['teams', page], /* retry defaults to 3 */ });
```

## Common Mistakes

### ❌ WRONG: Object in queryKey
```typescript
export function useTeams(page: number, limit: number, search: string) {
  return useQuery({
    queryKey: ['teams', { page, limit, search }], // WRONG - object in key
    queryFn: async () => {
      return apiClient.get<PaginatedResponse<Team>>(
        `${ENDPOINTS.TEAM.LIST}?page=${page}&limit=${limit}&search=${search}`
      );
    },
  });
}
```

### ✅ CORRECT: Flat queryKey with primitives
```typescript
export function useTeams(page: number, limit: number, search: string) {
  return useQuery({
    queryKey: ['teams', page, limit, search], // CORRECT - flat primitives
    staleTime: STALE_TIMES.STANDARD,
    placeholderData: keepPreviousData,
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

### ❌ WRONG: Missing enabled guard
```typescript
export function useTeam(teamId: string | undefined) {
  return useQuery({
    queryKey: ['team', teamId],
    queryFn: async () => {
      // Will throw error when teamId is undefined
      return apiClient.get<Team>(ENDPOINTS.TEAM.DETAIL(teamId!));
    },
  });
}
```

### ✅ CORRECT: Enabled guard for conditional query
```typescript
export function useTeam(teamId: string | undefined) {
  return useQuery({
    queryKey: ['team', teamId],
    staleTime: STALE_TIMES.STANDARD,
    enabled: !!teamId, // CORRECT - prevents query when ID is missing
    queryFn: async () => {
      if (!teamId) throw new Error('Team ID is required');
      return apiClient.get<Team>(ENDPOINTS.TEAM.DETAIL(teamId));
    },
  });
}
```

### ❌ WRONG: Hardcoded stale time
```typescript
export function useTeams(page: number, limit: number) {
  return useQuery({
    queryKey: ['teams', page, limit],
    staleTime: 120000, // WRONG - hardcoded value
    queryFn: async () => {
      return apiClient.get<PaginatedResponse<Team>>(ENDPOINTS.TEAM.LIST);
    },
  });
}
```

### ✅ CORRECT: Use STALE_TIMES constant
```typescript
export function useTeams(page: number, limit: number) {
  return useQuery({
    queryKey: ['teams', page, limit],
    staleTime: STALE_TIMES.STANDARD, // CORRECT - named constant
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      return apiClient.get<PaginatedResponse<Team>>(
        `${ENDPOINTS.TEAM.LIST}?${params.toString()}`
      );
    },
  });
}
```

### ❌ WRONG: Missing search param in queryKey
```typescript
export function useTeams(page: number, limit: number, search: string) {
  return useQuery({
    queryKey: ['teams', page, limit], // WRONG - missing search
    staleTime: STALE_TIMES.STANDARD,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search, // Query uses search...
      });
      return apiClient.get<PaginatedResponse<Team>>(
        `${ENDPOINTS.TEAM.LIST}?${params.toString()}`
      );
    },
  });
}
```

### ✅ CORRECT: All params in queryKey
```typescript
export function useTeams(page: number, limit: number, search: string) {
  return useQuery({
    queryKey: ['teams', page, limit, search], // CORRECT - includes search
    staleTime: STALE_TIMES.STANDARD,
    placeholderData: keepPreviousData,
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
