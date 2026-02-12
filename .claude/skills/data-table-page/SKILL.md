---
name: data-table-page
description: Generate a paginated table page for AEGIRA frontend. Use when creating list pages with server-side pagination using DataTable, PaginationState, and ColumnDef.
---
# Data Table Page

Paginated list page using `DataTable` component with server-side pagination.

## File Structure

```
aegira-frontend/src/features/<feature>/
├── pages/
│   └── Admin<Feature>sPage.tsx       # List page with DataTable
└── hooks/
    └── use<Feature>s.ts              # Query + mutation hooks (grouped)
```

## Data Table Page Pattern

<!-- BUILT FROM: .ai/patterns/frontend/data-table-pattern.md -->
# DataTable Pattern
> TanStack Table with server-side pagination, column definitions outside component, and safe data access

## When to Use
- Any list/table page with paginated data
- Server-side paginated endpoints (most list endpoints)
- Tables with sorting, search, and actions
- Admin tables, team member lists, check-in history, incident lists

## Canonical Implementation

### Full Table Page with Server-Side Pagination

```typescript
import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Users, Plus, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageLoader } from '@/components/common/PageLoader';
import { PageHeader } from '@/components/common/PageHeader';
import { TableSearch } from '@/components/common/TableSearch';
import { useTeams, type Team } from '@/features/team/hooks/useTeams';
import { ROUTES } from '@/config/routes.config';
import { buildRoute } from '@/lib/utils/route.utils';

// ========================================
// 1. COLUMNS DEFINED OUTSIDE THE COMPONENT
// ========================================
// Use a factory function when columns need callbacks (navigation, actions)
const getColumns = (
  onNavigate: (teamId: string) => void
): ColumnDef<Team>[] => [
  {
    accessorKey: 'name',
    header: ({ column }) => <SortableHeader column={column}>Team Name</SortableHeader>,
    cell: ({ row }) => (
      <div
        className="cursor-pointer hover:text-primary"
        onClick={() => onNavigate(row.original.id)}
      >
        <p className="font-medium">{row.original.name}</p>
        {row.original.description && (
          <p className="text-sm text-muted-foreground">{row.original.description}</p>
        )}
      </div>
    ),
  },
  {
    accessorKey: '_count.members',
    header: 'Members',
    cell: ({ row }) => (
      <Badge variant="secondary">{row.original._count?.members ?? 0}</Badge>
    ),
  },
  {
    accessorKey: 'is_active',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={row.original.is_active ? 'success' : 'secondary'}>
        {row.original.is_active ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Actions menu">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onNavigate(row.original.id)}>
            View Details
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

// ========================================
// 2. PAGE COMPONENT
// ========================================
export function TeamsPage() {
  const navigate = useNavigate();

  // Pagination state (0-indexed for TanStack Table)
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  // Search: two states for input vs committed search
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Query hook — convert pageIndex+1 for 1-indexed API
  const { data, isLoading, error } = useTeams(
    pagination.pageIndex + 1,  // API is 1-indexed
    pagination.pageSize,
    false, // includeInactive
    search
  );

  // Search handler — reset to page 1
  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  // Memoized navigation callback
  const handleNavigate = useCallback(
    (teamId: string) => {
      navigate(buildRoute(ROUTES.TEAM_DETAIL, { teamId }));
    },
    [navigate]
  );

  // Safe data access — NEVER pass undefined
  const teams = data?.items ?? [];
  const pageCount = data?.pagination?.totalPages ?? 0;
  const totalCount = data?.pagination?.total ?? 0;

  // Memoize columns when they depend on callbacks
  const columns = useMemo(() => getColumns(handleNavigate), [handleNavigate]);

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <div className="space-y-6">
        <PageHeader
          title="Teams"
          description="Manage your teams and team members"
          action={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Team
            </Button>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Teams ({totalCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <TableSearch
                placeholder="Search teams..."
                value={searchInput}
                onChange={setSearchInput}
                onSearch={handleSearch}
              />
              <DataTable
                columns={columns}
                data={teams}
                pageCount={pageCount}
                pagination={pagination}
                onPaginationChange={setPagination}
                isLoading={isLoading}
                totalCount={totalCount}
                emptyMessage={
                  search
                    ? 'No teams found. Try a different search term.'
                    : 'No teams yet. Create your first team to get started.'
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLoader>
  );
}
```

### Static Columns (No Dependencies)

When columns have no callback dependencies, define them as a simple constant.

```typescript
// Static columns — no callbacks needed
const columns: ColumnDef<AuditLog>[] = [
  {
    accessorKey: 'created_at',
    header: ({ column }) => <SortableHeader column={column}>Date</SortableHeader>,
    cell: ({ row }) => formatDate(row.original.created_at),
  },
  {
    accessorKey: 'action',
    header: 'Action',
    cell: ({ row }) => (
      <Badge variant="outline">{row.original.action}</Badge>
    ),
  },
  {
    accessorKey: 'person.full_name',
    header: 'User',
  },
];
```

### Columns with Dependencies (Use getColumns + useMemo)

When columns need callbacks or external data, use a factory function.

```typescript
// Factory function for columns with callbacks
const getColumns = (
  onView: (id: string) => void,
  onDelete: (id: string) => void
): ColumnDef<Team>[] => [
  // ... columns that use onView / onDelete
];

// In component
const columns = useMemo(
  () => getColumns(handleView, handleDelete),
  [handleView, handleDelete]
);
```

## DataTable Props Reference

```typescript
interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];  // Column definitions
  data: TData[];                         // Row data (never undefined)

  // Server-side pagination
  pageCount?: number;                    // Total pages from API
  pagination?: PaginationState;          // { pageIndex, pageSize }
  onPaginationChange?: (p: PaginationState) => void;

  // Features
  searchable?: boolean;                  // Built-in client-side search
  searchPlaceholder?: string;
  searchColumn?: string;

  // Loading & empty
  isLoading?: boolean;
  emptyMessage?: string;
  totalCount?: number;                   // Total items count for display
}
```

## Pagination Index Conversion

```
TanStack Table: 0-indexed (pageIndex = 0 means page 1)
Backend API:    1-indexed (page = 1 means first page)

When calling API:  pagination.pageIndex + 1
When displaying:   pageIndex + 1 (handled by DataTable internally)
```

## Search Pattern

Use `TableSearch` from `@/components/common/TableSearch` for server-side search.

```typescript
// Two states: input value (immediate) and committed search (on button click)
const [searchInput, setSearchInput] = useState('');
const [search, setSearch] = useState('');

const handleSearch = () => {
  setSearch(searchInput.trim());
  setPagination((prev) => ({ ...prev, pageIndex: 0 })); // Reset to first page
};

<TableSearch
  placeholder="Search teams..."
  value={searchInput}
  onChange={setSearchInput}
  onSearch={handleSearch}
/>
```

## Rules

### Column Definitions
- ✅ **DO** define columns OUTSIDE the component (prevents re-renders on every render cycle)
- ✅ **DO** use `useMemo` for columns that depend on callbacks
- ✅ **DO** use `useCallback` for navigation/action handlers passed to columns
- ✅ **DO** use `SortableHeader` from `@/components/ui/data-table` for sortable columns
- ✅ **DO** use `row.original` to access the full row data in cell renderers
- ❌ **NEVER** define columns inside the component body (causes table re-renders)
- ❌ **NEVER** define inline arrow functions for column callbacks without memoization

### Pagination
- ✅ **DO** convert `pageIndex + 1` when passing to API hooks (0-indexed to 1-indexed)
- ✅ **DO** use `data?.pagination?.totalPages ?? 0` for `pageCount`
- ✅ **DO** initialize pagination state: `{ pageIndex: 0, pageSize: 20 }`
- ✅ **DO** reset `pageIndex` to 0 when search/filter changes
- ❌ **NEVER** pass raw `pageIndex` to the API (off by one)
- ❌ **NEVER** forget to reset pagination on search

### Data Access
- ✅ **DO** use `data?.items ?? []` for the `data` prop (never pass undefined)
- ✅ **DO** use `data?.pagination?.total ?? 0` for `totalCount`
- ✅ **DO** provide contextual `emptyMessage` (different for search vs no data)
- ❌ **NEVER** pass `data?.items` directly (can be undefined)
- ❌ **NEVER** pass `undefined` to DataTable's `data` prop

### Search
- ✅ **DO** use `TableSearch` component from `@/components/common/TableSearch`
- ✅ **DO** use two-state pattern: `searchInput` (live) + `search` (committed)
- ❌ **NEVER** build custom search with inline Input + Button
- ❌ **NEVER** trigger search on every keystroke (commit on Enter/button click)

## Common Mistakes

### WRONG: Columns defined inside component
```typescript
export function TeamsPage() {
  // WRONG - re-created on every render, causes table to re-mount
  const columns: ColumnDef<Team>[] = [
    { accessorKey: 'name', header: 'Name' },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button onClick={() => navigate(`/teams/${row.original.id}`)}>View</Button>
      ),
    },
  ];

  return <DataTable columns={columns} data={data?.items ?? []} />;
}
```

### CORRECT: Columns defined outside with factory function
```typescript
const getColumns = (onNavigate: (id: string) => void): ColumnDef<Team>[] => [
  { accessorKey: 'name', header: 'Name' },
  {
    id: 'actions',
    cell: ({ row }) => (
      <Button onClick={() => onNavigate(row.original.id)}>View</Button>
    ),
  },
];

export function TeamsPage() {
  const navigate = useNavigate();
  const handleNavigate = useCallback(
    (id: string) => navigate(buildRoute(ROUTES.TEAM_DETAIL, { teamId: id })),
    [navigate]
  );
  const columns = useMemo(() => getColumns(handleNavigate), [handleNavigate]);

  return <DataTable columns={columns} data={data?.items ?? []} />;
}
```

### WRONG: Passing undefined data
```typescript
<DataTable
  columns={columns}
  data={data?.items}                      // WRONG - undefined when loading
  pageCount={data?.pagination?.totalPages} // WRONG - undefined when loading
/>
```

### CORRECT: Safe fallbacks
```typescript
<DataTable
  columns={columns}
  data={data?.items ?? []}                       // CORRECT - always array
  pageCount={data?.pagination?.totalPages ?? 0}  // CORRECT - always number
  totalCount={data?.pagination?.total ?? 0}
/>
```

### WRONG: Not converting page index
```typescript
const { data } = useTeams(
  pagination.pageIndex,    // WRONG - sends 0 for first page
  pagination.pageSize
);
```

### CORRECT: Converting 0-indexed to 1-indexed
```typescript
const { data } = useTeams(
  pagination.pageIndex + 1,  // CORRECT - sends 1 for first page
  pagination.pageSize
);
```

### WRONG: Building a manual HTML table
```typescript
// WRONG - building a manual table instead of using DataTable
export function TeamsPage() {
  return (
    <table>
      <thead>
        <tr><th>Name</th><th>Status</th></tr>
      </thead>
      <tbody>
        {teams.map((team) => (
          <tr key={team.id}>
            <td>{team.name}</td>
            <td>{team.is_active ? 'Active' : 'Inactive'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### CORRECT: Using DataTable component
```typescript
const columns: ColumnDef<Team>[] = [
  { accessorKey: 'name', header: 'Name' },
  {
    accessorKey: 'is_active',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={row.original.is_active ? 'success' : 'secondary'}>
        {row.original.is_active ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
];

export function TeamsPage() {
  return (
    <DataTable
      columns={columns}
      data={data?.items ?? []}
      pageCount={data?.pagination?.totalPages ?? 0}
      pagination={pagination}
      onPaginationChange={setPagination}
    />
  );
}
```

### WRONG: Not resetting pagination on search
```typescript
const handleSearch = () => {
  setSearch(searchInput.trim());
  // WRONG - stays on current page, may show empty results
};
```

### CORRECT: Reset to first page on search
```typescript
const handleSearch = () => {
  setSearch(searchInput.trim());
  setPagination((prev) => ({ ...prev, pageIndex: 0 })); // CORRECT - back to page 1
};
```


## Companion Query Hook Pattern

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


## Checklist

- [ ] Columns defined OUTSIDE the component as `const columns: ColumnDef<T>[]`
- [ ] Uses `DataTable` from `@/components/ui/data-table`
- [ ] Converts page index: `pagination.pageIndex + 1` (table 0-indexed, API 1-indexed)
- [ ] Uses `useDeferredValue` for search to avoid excessive API calls
- [ ] Resets `pageIndex` to 0 when search/filter changes
- [ ] Wrapped in `PageLoader` with `skeleton="table"`
- [ ] Uses `data?.items ?? []` (never passes undefined)
- [ ] Accesses total from `data?.pagination?.total`
- [ ] Passes `isLoading`, `totalCount`, and `emptyMessage` to DataTable
- [ ] Actions column with DropdownMenu for row-level operations
- [ ] Uses `ROUTES` constants for navigation links
