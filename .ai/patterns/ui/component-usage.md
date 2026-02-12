# Component Usage Guide
> Standard component APIs - PageHeader, TableSearch, DataTable, StatCard, RoleBadge, EmptyState, ConfirmDialog, PageLoader

## When to Use
- When building any page in the frontend
- When displaying data in tables, cards, or lists
- When showing loading, empty, or error states
- When adding search, confirmation dialogs, or role badges
- Check `components/common/` and `components/ui/` BEFORE creating any new component

## Canonical Implementation

### PageHeader
Located at `@/components/common/PageHeader`. Used at the top of every page.

```tsx
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

// Basic usage
<PageHeader
  title="Teams"
  description="Manage your teams and team members"
/>

// With action button
<PageHeader
  title="Workers"
  description="View and manage all workers"
  action={
    <Button>
      <Plus className="mr-2 h-4 w-4" />
      Add Worker
    </Button>
  }
/>

// With period selector (analytics pages)
<PageHeader
  title="WHS Analytics"
  description="Historical incident trends and distributions"
  action={
    <div className="flex items-center gap-0.5 rounded-lg border p-1">
      {PERIOD_OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          variant={period === opt.value ? 'default' : 'ghost'}
          size="sm"
          className={cn(
            'h-8 px-4 rounded-md text-xs font-medium',
            period !== opt.value && 'text-muted-foreground'
          )}
          onClick={() => setPeriod(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  }
/>
```

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | Yes | Page title (rendered as h1) |
| `description` | `string` | No | Subtitle below the title |
| `action` | `React.ReactNode` | No | Buttons/controls on the right |
| `className` | `string` | No | Additional CSS classes |

---

### TableSearch
Located at `@/components/common/TableSearch`. Used for server-side search on list pages.

```tsx
import { TableSearch } from '@/components/common/TableSearch';

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

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `placeholder` | `string` | No | Placeholder text (default: "Search...") |
| `value` | `string` | Yes | Current input value |
| `onChange` | `(value: string) => void` | Yes | Called on input change |
| `onSearch` | `() => void` | Yes | Called on Enter key or Search button click |
| `className` | `string` | No | Additional CSS classes |

---

### DataTable
Located at `@/components/ui/data-table`. Used for ALL tabular data with server-side pagination.

```tsx
import { useState, useMemo, useCallback } from 'react';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import type { Team } from '@/types/team.types';

// Define columns OUTSIDE the component (or via a factory function)
const getColumns = (
  onNavigate: (id: string) => void
): ColumnDef<Team>[] => [
  {
    accessorKey: 'name',
    header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
    cell: ({ row }) => (
      <span
        className="cursor-pointer hover:text-primary font-medium"
        onClick={() => onNavigate(row.original.id)}
      >
        {row.original.name}
      </span>
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
];

export function TeamsPage() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const { data, isLoading, error } = useTeams(
    pagination.pageIndex + 1, // API is 1-indexed
    pagination.pageSize
  );

  const handleNavigate = useCallback(
    (id: string) => navigate(buildRoute(ROUTES.TEAM_DETAIL, { teamId: id })),
    [navigate]
  );

  const columns = useMemo(() => getColumns(handleNavigate), [handleNavigate]);

  return (
    <DataTable
      columns={columns}
      data={data?.items ?? []}
      pageCount={data?.pagination?.totalPages}
      pagination={pagination}
      onPaginationChange={setPagination}
      isLoading={isLoading}
      totalCount={data?.pagination?.total}
      emptyMessage="No teams found."
    />
  );
}
```

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `columns` | `ColumnDef<TData, TValue>[]` | Yes | Column definitions |
| `data` | `TData[]` | Yes | Array of row data |
| `pageCount` | `number` | No | Total pages (server-side pagination) |
| `pagination` | `PaginationState` | No | Current page state `{ pageIndex, pageSize }` |
| `onPaginationChange` | `(pagination: PaginationState) => void` | No | Pagination change handler |
| `searchable` | `boolean` | No | Enable client-side column filter |
| `searchColumn` | `string` | No | Column key for client-side filter |
| `isLoading` | `boolean` | No | Show skeleton rows |
| `emptyMessage` | `string` | No | Message when no data |
| `totalCount` | `number` | No | Total record count for display |

---

### StatCard
Located at `@/features/dashboard/components/StatCard`. Used for numeric metrics.

```tsx
import { StatCard } from '@/features/dashboard/components/StatCard';
import { Users, Activity, Shield, AlertTriangle } from 'lucide-react';

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <StatCard
    title="Total Workers"
    value={25}
    icon={<Users className="h-5 w-5" />}
    iconBgColor="blue"
    description="3 unassigned"
  />
  <StatCard
    title="Avg Readiness"
    value="78%"
    icon={<Activity className="h-5 w-5" />}
    iconBgColor="green"
  />
  <StatCard
    title="Active Teams"
    value={5}
    icon={<Shield className="h-5 w-5" />}
    iconBgColor="purple"
  />
  <StatCard
    title="Open Incidents"
    value={3}
    icon={<AlertTriangle className="h-5 w-5" />}
    iconBgColor="red"
  />
</div>

// Without icons (analytics summary cards)
<StatCard title="Total Incidents" value={formatNumber(42)} />
<StatCard title="Approval Rate" value={formatPercentage(85)} />
```

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | Yes | Metric label |
| `value` | `string \| number` | Yes | Metric value |
| `icon` | `React.ReactNode` | No | Lucide icon element |
| `iconBgColor` | `'blue' \| 'green' \| 'purple' \| 'orange' \| 'red'` | No | Icon background color (default: "blue") |
| `description` | `string` | No | Small text below the value |
| `className` | `string` | No | Additional CSS classes |

---

### RoleBadge
Located at `@/components/common/RoleBadge`. Used everywhere a user role is displayed.

```tsx
import { RoleBadge } from '@/components/common/RoleBadge';

<RoleBadge role={person.role} />
// Renders: <Badge variant="destructive">Admin</Badge>   (for ADMIN)
// Renders: <Badge variant="secondary">WHS</Badge>       (for WHS)
// Renders: <Badge variant="info">Supervisor</Badge>     (for SUPERVISOR)
// Renders: <Badge variant="warning">Team Lead</Badge>   (for TEAM_LEAD)
// Renders: <Badge variant="outline">Worker</Badge>      (for WORKER)
```

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `role` | `UserRole` | Yes | One of: ADMIN, WHS, SUPERVISOR, TEAM_LEAD, WORKER |

---

### EmptyState
Located at `@/components/common/EmptyState`. Used when data is empty.

```tsx
import { EmptyState } from '@/components/common/EmptyState';
import { Inbox, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Basic usage
<EmptyState
  title="No teams found"
  description="Create your first team to get started"
/>

// With icon
<EmptyState
  title="No trend data"
  description="No incidents recorded in this period"
  icon={<TrendingUp className="h-10 w-10" />}
/>

// With action button
<EmptyState
  title="No workers yet"
  description="Add your first worker to begin tracking check-ins"
  icon={<Inbox className="h-10 w-10" />}
  action={
    <Button onClick={() => navigate(ROUTES.ADMIN_WORKER_CREATE)}>
      Add Worker
    </Button>
  }
/>
```

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | Yes | Empty state heading |
| `description` | `string` | No | Subtitle text |
| `icon` | `React.ReactNode` | No | Lucide icon element |
| `action` | `React.ReactNode` | No | CTA button |
| `className` | `string` | No | Additional CSS classes |

---

### ConfirmDialog
Located at `@/components/common/ConfirmDialog`. Used for destructive actions (delete, deactivate).

```tsx
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

const [deleteOpen, setDeleteOpen] = useState(false);

<ConfirmDialog
  open={deleteOpen}
  onOpenChange={setDeleteOpen}
  title="Delete Team"
  description="Are you sure you want to delete this team? This action cannot be undone."
  confirmLabel="Delete"
  cancelLabel="Cancel"
  variant="destructive"
  isLoading={isDeleting}
  onConfirm={async () => {
    try {
      await deleteTeam.mutateAsync(teamId);
      toast.success('Team deleted');
      setDeleteOpen(false);
    } catch (error) {
      toast.error('Failed to delete team');
    }
  }}
/>
```

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | `boolean` | Yes | Dialog visibility |
| `onOpenChange` | `(open: boolean) => void` | Yes | Toggle handler |
| `title` | `string` | Yes | Dialog title |
| `description` | `string` | Yes | Confirmation message |
| `confirmLabel` | `string` | No | Confirm button text (default: "Confirm") |
| `cancelLabel` | `string` | No | Cancel button text (default: "Cancel") |
| `onConfirm` | `() => void` | Yes | Called when user confirms |
| `onCancel` | `() => void` | No | Called when user cancels |
| `variant` | `'default' \| 'destructive'` | No | Button style (default: "default") |
| `isLoading` | `boolean` | No | Disable buttons while loading |

---

### PageLoader
Located at `@/components/common/PageLoader`. Wraps page content to handle loading/error/skeleton states.

```tsx
import { PageLoader } from '@/components/common/PageLoader';

const { data, isLoading, error } = useTeams();

<PageLoader isLoading={isLoading} error={error} skeleton="table">
  <YourContent data={data} />
</PageLoader>

// Early return pattern (requires children wrapper)
if (!data) {
  return (
    <PageLoader isLoading={true} skeleton="detail">
      <></>
    </PageLoader>
  );
}
```

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isLoading` | `boolean` | Yes | Show skeleton when true |
| `error` | `Error \| null` | No | Show error message when present |
| `skeleton` | `SkeletonType` | No | Skeleton variant (default: "page") |
| `children` | `React.ReactNode` | Yes | Page content |

**Skeleton Types:**
| Type | Use Case |
|------|----------|
| `'page'` | Generic page layout |
| `'table'` | List pages with DataTable |
| `'form'` | Create/edit forms |
| `'detail'` | Detail pages with info card |
| `'detail-content'` | Detail content sections |
| `'dashboard'` | Dashboard pages with stat cards |
| `'team-lead-dashboard'` | Team lead dashboard layout |
| `'cards'` | Card grid layouts |
| `'check-in'` | Check-in form |
| `'stats'` | Stat cards only |

## Rules
- ✅ DO use `PageHeader` at the top of every page
- ✅ DO use `TableSearch` from `@/components/common/TableSearch` for server-side search
- ✅ DO use `DataTable` from `@/components/ui/data-table` for ALL tables
- ✅ DO use `StatCard` from `@/features/dashboard/components/StatCard` for numeric metrics
- ✅ DO use `RoleBadge` from `@/components/common/RoleBadge` for role display
- ✅ DO use `EmptyState` for empty data in charts and lists
- ✅ DO use `ConfirmDialog` for all destructive actions (delete, deactivate)
- ✅ DO use `PageLoader` as the outermost wrapper on every page
- ✅ DO define DataTable columns outside the component (or in a memoized factory function)
- ✅ DO pass `data?.items ?? []` (never undefined) to DataTable
- ✅ DO convert page index: `pagination.pageIndex + 1` for API calls
- ❌ NEVER build inline search with Input + Button (use TableSearch)
- ❌ NEVER create inline role variant maps (use RoleBadge)
- ❌ NEVER build manual HTML `<table>` elements (use DataTable)
- ❌ NEVER create custom loading wrappers (use PageLoader)
- ❌ NEVER create custom stat cards (use StatCard)
- ❌ NEVER define DataTable columns inside the component body (causes re-renders)

## Common Mistakes

### ❌ WRONG: Inline search component
```tsx
// Never build inline search — use TableSearch
<div className="flex gap-2">
  <Input
    placeholder="Search..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
  />
  <Button onClick={handleSearch}>
    <Search className="h-4 w-4" />
  </Button>
</div>
```

### ✅ CORRECT: Use TableSearch
```tsx
import { TableSearch } from '@/components/common/TableSearch';

<TableSearch
  placeholder="Search teams..."
  value={searchInput}
  onChange={setSearchInput}
  onSearch={handleSearch}
/>
```

### ❌ WRONG: Inline role variant map
```tsx
// Never inline role display logic
const roleVariant = role === 'ADMIN' ? 'destructive' : role === 'WHS' ? 'secondary' : 'default';
<Badge variant={roleVariant}>{role}</Badge>
```

### ✅ CORRECT: Use RoleBadge
```tsx
import { RoleBadge } from '@/components/common/RoleBadge';

<RoleBadge role={person.role} />
```

### ❌ WRONG: Columns defined inside component
```tsx
export function TeamsPage() {
  // Columns re-created every render — causes flickering
  const columns: ColumnDef<Team>[] = [
    { accessorKey: 'name', header: 'Name' },
  ];

  return <DataTable columns={columns} data={data} />;
}
```

### ✅ CORRECT: Columns outside component or memoized
```tsx
// Option 1: Static columns outside component
const columns: ColumnDef<Team>[] = [
  { accessorKey: 'name', header: 'Name' },
];

// Option 2: Factory function + useMemo (when columns need callbacks)
const getColumns = (onNavigate: (id: string) => void): ColumnDef<Team>[] => [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <span onClick={() => onNavigate(row.original.id)}>{row.original.name}</span>
    ),
  },
];

export function TeamsPage() {
  const handleNavigate = useCallback((id: string) => navigate(`/teams/${id}`), [navigate]);
  const columns = useMemo(() => getColumns(handleNavigate), [handleNavigate]);

  return <DataTable columns={columns} data={data?.items ?? []} />;
}
```

### ❌ WRONG: Missing PageLoader wrapper
```tsx
export function TeamsPage() {
  const { data, isLoading, error } = useTeams();

  if (isLoading) return <div>Loading...</div>;  // Custom loading
  if (error) return <div>Error!</div>;           // Custom error

  return <div>{/* content */}</div>;
}
```

### ✅ CORRECT: Use PageLoader
```tsx
export function TeamsPage() {
  const { data, isLoading, error } = useTeams();

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <div className="space-y-6">
        <PageHeader title="Teams" />
        <DataTable columns={columns} data={data?.items ?? []} />
      </div>
    </PageLoader>
  );
}
```
