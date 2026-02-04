---
description: TanStack Query Read Hook Patterns for AEGIRA Frontend
globs: ["aegira-frontend/src/**/hooks/**/*.ts"]
alwaysApply: false
---
# Query Hooks (Read Operations)

TanStack Query v5 read hooks for AEGIRA. Uses `apiClient` + `ENDPOINTS` constants + `STALE_TIMES` config.

## File Location & Naming

```
aegira-frontend/src/features/<feature>/hooks/
├── usePersons.ts           # Paginated list + mutations (grouped)
├── useCheckInHistory.ts    # Paginated history
├── useCheckInStatus.ts     # Single status
├── useTodayCheckIn.ts      # Today's data
├── useDashboardStats.ts    # Aggregated data
```

Filenames use **camelCase** (not kebab-case).

## Required Imports

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type { PaginatedResponse } from '@/types/common.types';
import type { Feature } from '@/types/feature.types';

// Re-export types for convenience
export type { Feature };
```

## Query Key Structure

Plain strings and primitives, NOT path-like patterns:

```typescript
['persons', page, limit, includeInactive, search]  // Paginated list
['person', personId]                                 // Single by ID
['person', personId, 'stats']                        // Related data
['check-ins', 'history', page, pageSize]             // History
['check-ins', 'status']                              // Status
['check-ins', 'today']                               // Today
['dashboard', 'stats']                               // Dashboard
['auth', 'session']                                  // Session
```

## Stale Time Tiers

```typescript
STALE_TIMES.REALTIME   // 30s  - status, notifications
STALE_TIMES.STANDARD   // 2m   - teams, workers, check-ins
STALE_TIMES.STATIC     // 10m  - company settings, holidays
STALE_TIMES.IMMUTABLE  // 30m  - historical data, audit logs
```

## 1. Paginated List Query

```typescript
export function usePersons(page = 1, limit = 20, includeInactive = false, search = '') {
  return useQuery({
    queryKey: ['persons', page, limit, includeInactive, search],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        includeInactive: String(includeInactive),
      });
      if (search) params.set('search', search);
      return apiClient.get<PaginatedResponse<Person>>(
        `${ENDPOINTS.PERSON.LIST}?${params.toString()}`
      );
    },
  });
}
```

## 2. Single Entity Query (with dynamic ENDPOINT)

```typescript
export function usePerson(personId: string) {
  return useQuery({
    queryKey: ['person', personId],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: () => apiClient.get<Person>(ENDPOINTS.PERSON.BY_ID(personId)),
    enabled: !!personId,
  });
}
```

**Note:** Dynamic ENDPOINTS are functions: `ENDPOINTS.PERSON.BY_ID(id)` returns `/persons/${id}`.

## 3. Paginated Query with Transformation

```typescript
export function useCheckInHistory({ page = 1, pageSize = 10 } = {}) {
  return useQuery({
    queryKey: ['check-ins', 'history', page, pageSize],
    staleTime: STALE_TIMES.IMMUTABLE,
    queryFn: async () => {
      const data = await apiClient.get<BackendPaginatedResponse>(
        `${ENDPOINTS.CHECK_IN.HISTORY}?page=${page}&pageSize=${pageSize}`
      );

      // Transform snake_case → camelCase at the boundary
      return {
        items: data.items.map(transformCheckIn),
        total: data.pagination.total,
        page: data.pagination.page,
        pageSize: data.pagination.limit,
        totalPages: data.pagination.totalPages,
      };
    },
  });
}
```

## 4. Single Status Query

```typescript
export function useCheckInStatus() {
  return useQuery({
    queryKey: ['check-ins', 'status'],
    staleTime: STALE_TIMES.REALTIME,
    queryFn: () => apiClient.get<CheckInStatus>(ENDPOINTS.CHECK_IN.STATUS),
  });
}
```

## ENDPOINTS Reference (Dynamic vs Static)

```typescript
// Static endpoints - string constants
ENDPOINTS.PERSON.LIST           // '/persons'
ENDPOINTS.CHECK_IN.SUBMIT       // '/check-ins'
ENDPOINTS.CHECK_IN.STATUS       // '/check-ins/status'

// Dynamic endpoints - functions that return strings
ENDPOINTS.PERSON.BY_ID(id)      // `/persons/${id}`
ENDPOINTS.PERSON.UPDATE(id)     // `/persons/${id}`
ENDPOINTS.TEAM.BY_ID(id)        // `/teams/${id}`
ENDPOINTS.CHECK_IN.BY_ID(id)    // `/check-ins/${id}`
```

## Key Rules

- ALWAYS use `apiClient` from `@/lib/api/client` (NOT raw fetch)
- ALWAYS use `ENDPOINTS` constants from `@/lib/api/endpoints`
- ALWAYS use `STALE_TIMES` from `@/config/query.config`
- ALWAYS transform snake_case → camelCase inside queryFn
- ALWAYS use plain strings + primitives in query keys
- ALWAYS re-export types from hooks for consumer convenience
- ALWAYS use `enabled: !!id` for single-entity queries with dynamic ID
- Use dynamic ENDPOINTS as functions: `ENDPOINTS.PERSON.BY_ID(id)` not string concat
