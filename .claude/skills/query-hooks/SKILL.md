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

## Query Hook Patterns

<!-- BUILT FROM: .ai/patterns/frontend/query-hooks.md -->
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
import { STALE_TIMES } from '@/lib/api/stale-times';
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
// From @/lib/api/stale-times.ts
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


## Response Format Reference

<!-- BUILT FROM: .ai/patterns/shared/response-format.md -->
# API Response Format
> Standard response envelope - success/paginated/error formats with apiClient unwrapping

## When to Use
- Every backend endpoint response
- Every frontend API call
- Understanding how data flows from backend to frontend hooks

## Response Formats

### Success Response
```typescript
// Backend controller
return c.json({
  success: true,
  data: team,  // T
});
```

### Paginated Response
```typescript
import { parsePagination, paginate } from '../../shared/pagination.utils.js';

export async function list(c: Context) {
  const { page, limit } = parsePagination(c.req.query());
  const repo = new TeamRepository(c.get('prisma'), c.get('companyId'));
  const { items, total } = await repo.findAll(page, limit);

  return c.json({
    success: true,
    data: paginate(items, page, limit, total),
  });
}

// Response shape:
{
  success: true,
  data: {
    items: T[],
    pagination: {
      page: number,
      limit: number,
      total: number,
      totalPages: number
    }
  }
}
```

### Error Response
```typescript
// Thrown via AppError
throw new AppError('TEAM_NOT_FOUND', 'Team not found', 404);

// Response shape:
{
  success: false,
  error: {
    code: 'TEAM_NOT_FOUND',
    message: 'Team not found'
  }
}
```

## Frontend API Client

The `apiClient` singleton automatically unwraps `response.data`:

```typescript
// Frontend apiClient internals
class APIClient {
  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      credentials: 'include',  // httpOnly cookies
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Request failed');
    }

    const json = await response.json();
    return json.data;  // ← Unwraps automatically
  }
}
```

### What Hooks Receive

```typescript
// Hooks receive T directly, NOT { success, data }
const { data } = useTeams();
// data = { items: Team[], pagination: {...} }
// NOT: { success: true, data: { items: [...] } }

const { data: team } = useTeam(teamId);
// team = { id, name, ... }
// NOT: { success: true, data: { id, name, ... } }
```

## ENDPOINTS Constants

```typescript
// src/lib/api/endpoints.ts
export const ENDPOINTS = {
  TEAM: {
    LIST: '/teams',
    DETAIL: (id: string) => `/teams/${id}`,
    CREATE: '/teams',
    UPDATE: (id: string) => `/teams/${id}`,
    DELETE: (id: string) => `/teams/${id}`,
    MEMBERS: (id: string) => `/teams/${id}/members`,
  },
  PERSON: {
    LIST: '/persons',
    DETAIL: (id: string) => `/persons/${id}`,
    // ...
  },
  DASHBOARD: {
    WHS_DASHBOARD: '/dashboard/whs',
    WHS_ANALYTICS: '/dashboard/whs/analytics',
  },
  // ...
} as const;
```

## Pagination Utilities

### Backend: parsePagination

```typescript
import { parsePagination } from '../../shared/pagination.utils.js';

const { page, limit } = parsePagination(c.req.query());
// Clamps: page min 1, max 10000; limit min 1, max 100
// Defaults: page = 1, limit = 20
```

### Backend: paginate

```typescript
import { paginate } from '../../shared/pagination.utils.js';

// paginate(items, page, limit, total) returns:
{
  items: T[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number  // Math.ceil(total / limit)
  }
}
```

### Frontend: Using Paginated Data

```typescript
export function TeamsPage() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,  // TanStack Table is 0-indexed
    pageSize: 20,
  });

  const { data } = useTeams(
    pagination.pageIndex + 1,  // API is 1-indexed
    pagination.pageSize
  );

  return (
    <DataTable
      columns={columns}
      data={data?.items ?? []}
      pageCount={data?.pagination?.totalPages}
      pagination={pagination}
      onPaginationChange={setPagination}
    />
  );
}
```

## Rules

- ✅ DO always return `{ success: true, data: T }` from backend
- ✅ DO use `paginate()` for all list endpoints
- ✅ DO use `parsePagination()` to clamp page/limit values
- ✅ DO use ENDPOINTS constants in frontend (never hardcode URLs)
- ✅ DO use `apiClient.get<T>()` with generic type parameter
- ✅ DO handle the automatic unwrapping (hooks receive `T`, not `{ success, data }`)
- ❌ NEVER hardcode API URLs: `apiClient.get('/api/v1/teams')` is WRONG
- ❌ NEVER manually build query strings: use `URLSearchParams`
- ❌ NEVER access `response.data.data` (apiClient already unwraps once)
- ❌ NEVER return non-standard response shapes from backend
- ❌ NEVER expose internal error details in error responses

## Common Mistakes

### ❌ WRONG: Hardcoded URL
```typescript
const { data } = useQuery({
  queryFn: () => apiClient.get('/api/v1/teams?page=1&limit=20'),
});
```

### ✅ CORRECT: ENDPOINTS + URLSearchParams
```typescript
const { data } = useQuery({
  queryFn: () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    return apiClient.get<PaginatedResponse<Team>>(
      `${ENDPOINTS.TEAM.LIST}?${params.toString()}`
    );
  },
});
```

### ❌ WRONG: Double unwrapping
```typescript
const { data } = useTeams();
const teams = data?.data?.items;  // WRONG - double .data
```

### ✅ CORRECT: Single level
```typescript
const { data } = useTeams();
const teams = data?.items;  // CORRECT - apiClient already unwrapped
```


## Stale Time Decision Tree

<!-- BUILT FROM: .ai/patterns/shared/decision-trees.md -->
# Decision Trees
> When to use what - service layer, stale times, keepPreviousData, transactions, custom hooks

## When to Use
- When deciding on the architecture for a new feature or endpoint
- When unsure about the correct pattern for a specific situation
- When reviewing code for pattern compliance

## Canonical Implementation

### Decision 1: When to Add a Service Layer

```
Does the controller need to...
├── Use multiple repositories?
│   └── YES → Add service layer
├── Perform complex calculations?
│   └── YES → Add service layer
├── Run a database transaction?
│   └── YES → Add service layer
├── Coordinate multiple side effects?
│   └── YES → Add service layer
└── Just do simple CRUD?
    └── NO service layer → Controller calls Repository directly
```

**Examples:**

| Operation | Service Needed? | Why |
|-----------|----------------|-----|
| List teams | No | Simple query, one repository |
| Create person | No | Single insert, one repository |
| Submit check-in | Yes | Readiness calculation + eligibility check + create |
| Assign team members | Yes | Multiple repos (team + person) + transaction |
| Process incident | Yes | Create incident + create case + notify + audit |
| Get person by ID | No | Simple query, one repository |
| Delete team | No | Single operation, one repository |
| Generate dashboard stats | Yes | Multiple repos + aggregation + calculations |

```typescript
// NO service: controller → repository directly
export async function list(c: Context) {
  const companyId = c.get('companyId') as string;
  const repo = new TeamRepository(c.get('prisma'), companyId);
  const result = await repo.findAll(page, limit);
  return c.json({ success: true, data: paginate(result.items, page, limit, result.total) });
}

// YES service: controller → service → repository
export async function submitCheckIn(c: Context) {
  const companyId = c.get('companyId') as string;
  const service = new CheckInService(c.get('prisma'), companyId);
  const result = await service.submitCheckIn(userId, body);
  return c.json({ success: true, data: result }, 201);
}
```

---

### Decision 2: Which Stale Time

```
How often does this data change?
├── Every few seconds (live metrics, notifications, dashboard)
│   └── REALTIME (30s)
├── Every few minutes (team lists, person lists, detail pages)
│   └── STANDARD (2m)
├── Rarely changes (analytics, company settings, historical data)
│   └── STATIC (10m)
└── Basically never changes (holidays, reference data, immutable records)
    └── IMMUTABLE (30m)
```

| Data Type | Stale Time | Constant | Duration |
|-----------|-----------|----------|----------|
| Dashboard stats (WHS, Admin) | `REALTIME` | `STALE_TIMES.REALTIME` | 30 seconds |
| Notification list/count | `REALTIME` | `STALE_TIMES.REALTIME` | 30 seconds |
| Check-in status | `REALTIME` | `STALE_TIMES.REALTIME` | 30 seconds |
| Team list | `STANDARD` | `STALE_TIMES.STANDARD` | 2 minutes |
| Person list/detail | `STANDARD` | `STALE_TIMES.STANDARD` | 2 minutes |
| Incident list | `STANDARD` | `STALE_TIMES.STANDARD` | 2 minutes |
| WHS analytics (period-based) | `STATIC` | `STALE_TIMES.STATIC` | 10 minutes |
| Company settings | `STATIC` | `STALE_TIMES.STATIC` | 10 minutes |
| Check-in history | `IMMUTABLE` | `STALE_TIMES.IMMUTABLE` | 30 minutes |
| Audit logs | `IMMUTABLE` | `STALE_TIMES.IMMUTABLE` | 30 minutes |
| Holidays | `IMMUTABLE` | `STALE_TIMES.IMMUTABLE` | 30 minutes |

```typescript
// Import from config
import { STALE_TIMES } from '@/config/query.config';

// NEVER hardcode values
staleTime: STALE_TIMES.REALTIME,   // 30_000
staleTime: STALE_TIMES.STANDARD,   // 120_000
staleTime: STALE_TIMES.STATIC,     // 600_000
staleTime: STALE_TIMES.IMMUTABLE,  // 1_800_000
```

---

### Decision 3: When to Use keepPreviousData

```
Does the query have parameters that change frequently?
├── Paginated list? (page, limit change)
│   └── YES → Use keepPreviousData
├── Search/filter changes? (debounced search string)
│   └── YES → Use keepPreviousData
├── Period selector? (7d, 30d, 90d)
│   └── YES → Use keepPreviousData
├── Tab-based filtering?
│   └── YES → Use keepPreviousData
└── Single entity by ID? (detail page)
    └── NO → Don't use keepPreviousData
```

```typescript
import { keepPreviousData } from '@tanstack/react-query';

// Paginated list → YES
export function useTeams(page: number, limit: number, search: string) {
  return useQuery({
    queryKey: ['teams', page, limit, search],
    staleTime: STALE_TIMES.STANDARD,
    placeholderData: keepPreviousData, // Smooth page transitions
    queryFn: async () => { /* ... */ },
  });
}

// Period-based analytics → YES
export function useWhsAnalytics(period: AnalyticsPeriod) {
  return useQuery({
    queryKey: ['analytics', 'whs', period],
    staleTime: STALE_TIMES.STATIC,
    placeholderData: keepPreviousData, // Smooth period switching
    queryFn: async () => { /* ... */ },
  });
}

// Single entity detail → NO
export function useTeam(teamId: string) {
  return useQuery({
    queryKey: ['team', teamId],
    staleTime: STALE_TIMES.STANDARD,
    enabled: !!teamId,
    // NO keepPreviousData — different entity entirely
    queryFn: async () => { /* ... */ },
  });
}
```

---

### Decision 4: When to Use Database Transactions

```
Does the operation...
├── Write to multiple tables?
│   └── YES → Use $transaction
├── Need atomicity (all-or-nothing)?
│   └── YES → Use $transaction
├── Read-then-write with consistency needs?
│   └── YES → Use $transaction
└── Single table insert/update/delete?
    └── NO → No transaction needed
```

```typescript
// SINGLE table operation → No transaction
async create(data: CreateTeamInput): Promise<Team> {
  return this.prisma.team.create({
    data: this.withCompany({ name: data.name }),
  });
}

// MULTI-table operation → Use transaction
async assignMembers(teamId: string, memberIds: string[]): Promise<void> {
  await this.prisma.$transaction(async (tx) => {
    // Verify team exists
    const team = await tx.team.findFirst({
      where: { id: teamId, company_id: this.companyId },
    });
    if (!team) throw Errors.notFound('Team');

    // Update all persons' team_id
    await tx.person.updateMany({
      where: {
        id: { in: memberIds },
        company_id: this.companyId,
      },
      data: { team_id: teamId },
    });
  });
}
```

---

### Decision 5: When to Extract Custom Hooks

```
Is the logic...
├── Used in 2+ components?
│   └── YES → Extract to shared hook
├── Complex state management (multiple useState + useEffect)?
│   └── YES → Extract to feature hook
├── API data fetching?
│   └── YES → ALWAYS create a query/mutation hook
├── Simple one-liner (single useState)?
│   └── NO → Keep inline in component
└── Business logic calculation?
    └── YES → Extract to utility function (not hook)
```

```typescript
// ALWAYS: API hooks in features/<feature>/hooks/
// useTeams.ts, useCreateTeam.ts, useWhsAnalytics.ts

// SHARED: Reusable behavior across features
// lib/hooks/use-debounce.ts, lib/hooks/use-toast.ts

// INLINE: Simple component-local state
const [isOpen, setIsOpen] = useState(false);  // Keep inline, don't extract

// UTILITY: Pure computation (not a hook)
// lib/utils/format.utils.ts → formatPercentage(value)
// lib/utils/date.utils.ts → formatRelativeTime(date)
```

---

### Decision 6: Where to Put Types

```
Is the type...
├── Used by multiple features?
│   └── src/types/<domain>.types.ts
├── Used only in one feature's hooks?
│   └── Co-locate in the hook file, re-export
├── A Zod schema inferred type (backend)?
│   └── Export from <feature>.validator.ts
├── Component props?
│   └── Define inline in the component file
└── API response shape?
    └── src/types/<domain>.types.ts
```

## Rules
- ✅ DO add a service layer when there are multi-repo operations, calculations, or transactions
- ✅ DO use the stale time constant that matches the data's update frequency
- ✅ DO use `keepPreviousData` for any query with user-controlled parameters (pagination, search, filters, period)
- ✅ DO use `$transaction` for multi-table writes that must be atomic
- ✅ DO extract API hooks for ALL data fetching (never inline `useQuery` in components)
- ✅ DO put shared types in `src/types/`, feature-local types in hook files
- ❌ NEVER create a service layer for simple CRUD (just proxies to repository)
- ❌ NEVER hardcode stale time values (always use `STALE_TIMES` constants)
- ❌ NEVER use `keepPreviousData` for single-entity detail queries
- ❌ NEVER skip transactions for multi-table write operations
- ❌ NEVER put business logic in utility functions that should be hooks (anything using React state/effects)

## Common Mistakes

### ❌ WRONG: Unnecessary service layer
```typescript
// Service that just proxies to repository — add no value
export class TeamService {
  async findAll(page: number, limit: number) {
    const repo = new TeamRepository(this.prisma, this.companyId);
    return repo.findAll(page, limit); // Just proxying!
  }
}
```

### ✅ CORRECT: Skip service for simple CRUD
```typescript
// Controller calls repository directly
export async function list(c: Context) {
  const companyId = c.get('companyId') as string;
  const repo = new TeamRepository(c.get('prisma'), companyId);
  const { items, total } = await repo.findAll(page, limit);
  return c.json({ success: true, data: paginate(items, page, limit, total) });
}
```

### ❌ WRONG: keepPreviousData on detail query
```typescript
export function useTeam(teamId: string) {
  return useQuery({
    queryKey: ['team', teamId],
    placeholderData: keepPreviousData, // WRONG: shows Team A data while loading Team B
    queryFn: () => apiClient.get<Team>(ENDPOINTS.TEAM.BY_ID(teamId)),
  });
}
```

### ✅ CORRECT: No keepPreviousData on detail queries
```typescript
export function useTeam(teamId: string) {
  return useQuery({
    queryKey: ['team', teamId],
    staleTime: STALE_TIMES.STANDARD,
    enabled: !!teamId,
    // No keepPreviousData — each entity is distinct
    queryFn: () => apiClient.get<Team>(ENDPOINTS.TEAM.BY_ID(teamId)),
  });
}
```


## Checklist

- [ ] queryKey includes ALL params that affect the response
- [ ] Used `STALE_TIMES` constant (not magic numbers)
- [ ] Used `ENDPOINTS` constant (not hardcoded URLs)
- [ ] Added `enabled: !!id` guard for dynamic IDs
- [ ] Built query params with `URLSearchParams`
- [ ] Re-exported types from hooks for consumer convenience
- [ ] Used `refetchInterval` for polling data
- [ ] Used `refetchOnWindowFocus: true` for dashboards
