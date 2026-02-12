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
