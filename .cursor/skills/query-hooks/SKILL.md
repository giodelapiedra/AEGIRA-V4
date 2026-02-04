---
name: query-hooks
description: Generate TanStack Query read hooks for AEGIRA frontend. Use when creating useQuery hooks for data fetching, working with hooks/ directories, or implementing paginated list queries.
---
# Query Hooks (Read Operations)

TanStack Query v5 read hooks for AEGIRA. Uses `apiClient` + `ENDPOINTS` constants + `STALE_TIMES` config.

## File Location & Naming

```
aegira-frontend/src/features/<feature>/hooks/
├── usePersons.ts           # Paginated list + mutations (grouped per entity)
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

// Re-export types for convenience (consumers import from hooks, not types/)
export type { Feature };
```

## Query Key Structure

Plain strings and primitives only — never objects or arrays inside keys:

```typescript
['persons', page, limit, includeInactive, search]  // Paginated list
['person', personId]                                 // Single by ID
['person', personId, 'stats']                        // Related data
['persons', 'team-leads', 'available', excludeTeamId] // Filtered subset
['check-ins', 'history', page, pageSize]             // History
['check-ins', 'status']                              // Status
['check-ins', 'today']                               // Today
['dashboard', 'worker']                              // Dashboard
['dashboard', 'team-lead']                           // Role-specific dashboard
['auth', 'session']                                  // Session
['notifications', 'preview']                         // Polling data
```

## Stale Time Tiers

```typescript
STALE_TIMES.REALTIME   // 30s  — check-in status, notifications, live dashboards
STALE_TIMES.STANDARD   // 2m   — teams, workers, check-ins, most lists
STALE_TIMES.STATIC     // 10m  — company settings, holidays
STALE_TIMES.IMMUTABLE  // 30m  — historical data, audit logs
```

## 1. Paginated List Query

```typescript
/**
 * Fetch all persons with pagination and optional filters
 */
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
/**
 * Fetch single person by ID
 */
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

## 3. Related Data Query

```typescript
/**
 * Get person stats (check-in streak, avg readiness, etc.)
 */
export function usePersonStats(personId: string) {
  return useQuery({
    queryKey: ['person', personId, 'stats'],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: () => apiClient.get<PersonStats>(ENDPOINTS.PERSON.STATS(personId)),
    enabled: !!personId,
  });
}
```

## 4. Filtered Subset Query (non-paginated)

```typescript
/**
 * Fetch available team leads for assignment dropdowns
 */
export function useTeamLeads(excludeTeamId?: string) {
  return useQuery({
    queryKey: ['persons', 'team-leads', 'available', excludeTeamId],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: async () => {
      const params = new URLSearchParams({
        role: 'TEAM_LEAD',
        limit: '100',
        availableOnly: 'true',
      });
      if (excludeTeamId) params.append('excludeTeamId', excludeTeamId);
      const response = await apiClient.get<PaginatedResponse<Person>>(
        `${ENDPOINTS.PERSON.LIST}?${params.toString()}`
      );
      return response.items; // Extract items for non-paginated use
    },
  });
}
```

## 5. Paginated Query with Transformation

Use transformation only when the frontend needs a different data shape than what the API returns (e.g., inverting a scale, renaming fields with different semantics):

```typescript
/**
 * Fetch check-in history with frontend-friendly field names
 */
export function useCheckInHistory({ page = 1, pageSize = 10 } = {}) {
  return useQuery({
    queryKey: ['check-ins', 'history', page, pageSize],
    staleTime: STALE_TIMES.IMMUTABLE,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      const data = await apiClient.get<PaginatedResponse<BackendCheckIn>>(
        `${ENDPOINTS.CHECK_IN.HISTORY}?${params.toString()}`
      );
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

## 6. Polling Query (Real-time Data)

```typescript
/**
 * Notification preview with 30s polling
 */
export function useNotificationPreview() {
  return useQuery({
    queryKey: ['notifications', 'preview'],
    staleTime: STALE_TIMES.REALTIME,
    refetchInterval: 30000,
    queryFn: () => apiClient.get<NotificationPreview>(ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT),
  });
}
```

## 7. Dashboard Query (with window focus refetch)

```typescript
/**
 * Team lead dashboard — refetch when user returns to tab
 */
export function useTeamLeadDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'team-lead'],
    staleTime: STALE_TIMES.STANDARD,
    refetchOnWindowFocus: true,
    queryFn: () => apiClient.get<TeamLeadDashboardStats>(ENDPOINTS.DASHBOARD.TEAM_LEAD),
  });
}
```

## ENDPOINTS Reference (Dynamic vs Static)

```typescript
// Static endpoints — string constants
ENDPOINTS.PERSON.LIST           // '/persons'
ENDPOINTS.CHECK_IN.SUBMIT       // '/check-ins'
ENDPOINTS.CHECK_IN.STATUS       // '/check-ins/status'
ENDPOINTS.DASHBOARD.WORKER      // '/dashboard/worker'

// Dynamic endpoints — functions that return strings
ENDPOINTS.PERSON.BY_ID(id)      // `/persons/${id}`
ENDPOINTS.PERSON.UPDATE(id)     // `/persons/${id}`
ENDPOINTS.PERSON.STATS(id)      // `/persons/${id}/stats`
ENDPOINTS.TEAM.BY_ID(id)        // `/teams/${id}`
ENDPOINTS.TEAM.MEMBERS(id)      // `/teams/${id}/members`
```

## Key Rules

- ALWAYS use `apiClient` from `@/lib/api/client` (NOT raw fetch)
- ALWAYS use `ENDPOINTS` constants from `@/lib/api/endpoints` — never hardcode URLs
- ALWAYS use `STALE_TIMES` from `@/config/query.config`
- ALWAYS build query params with `URLSearchParams` — never concatenate strings manually
- ALWAYS use plain strings + primitives in query keys (never objects/arrays)
- ALWAYS re-export types from hooks for consumer convenience
- ALWAYS use `enabled: !!id` for single-entity queries with dynamic ID
- ALWAYS include ALL parameters that affect the response in `queryKey`
- Transform data inside `queryFn` only when the frontend needs a different shape — most hooks return API data as-is
- Use `refetchInterval` for polling (notifications, live status)
- Use `refetchOnWindowFocus: true` for dashboards that should refresh on tab focus
