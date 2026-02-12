---
name: dashboard-page
description: Generate a role-specific dashboard page for AEGIRA frontend. Use when creating operational dashboards with StatCards, sub-components, and single-endpoint data loading.
---
# Role-Specific Dashboard Page

Role-specific dashboards show real-time operational data. Each role gets its own dashboard page, rendered via a switch in `Dashboard.tsx`.

## File Structure

```
aegira-frontend/src/features/dashboard/
├── pages/
│   ├── Dashboard.tsx                 # Role switch (renders correct dashboard)
│   └── <Role>Dashboard.tsx           # Role-specific dashboard page
├── components/
│   ├── StatCard.tsx                  # Reusable stat card (shared)
│   └── <role>/                       # Role-specific sub-components
│       ├── SummaryTable.tsx
│       ├── StatusBreakdown.tsx
│       └── ActivityFeed.tsx
├── hooks/
│   └── useDashboardStats.ts         # All dashboard hooks (one per role)
└── (types in src/types/<role>-dashboard.types.ts)
```

## Dashboard Page Pattern

<!-- BUILT FROM: .ai/patterns/frontend/page-patterns.md -->
# Page Patterns
> Standard page structures - list, detail, dashboard, analytics pages with consistent layout

## When to Use
- Every page component in the application
- List pages with DataTable and server-side pagination
- Detail pages with info cards and tabbed content
- Dashboard pages with stat cards and sub-components
- Analytics pages with period selectors and charts

## Canonical Implementation

### 1. List Page (DataTable + Pagination + Search)

```typescript
import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageLoader } from '@/components/common/PageLoader';
import { PageHeader } from '@/components/common/PageHeader';
import { TableSearch } from '@/components/common/TableSearch';
import { useTeams, type Team } from '@/features/team/hooks/useTeams';
import { ROUTES } from '@/config/routes.config';
import { buildRoute } from '@/lib/utils/route.utils';

// Columns defined OUTSIDE component to prevent re-renders
const getColumns = (
  onNavigate: (teamId: string) => void
): ColumnDef<Team>[] => [
  {
    accessorKey: 'name',
    header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
    cell: ({ row }) => (
      <div
        className="cursor-pointer hover:text-primary"
        onClick={() => onNavigate(row.original.id)}
      >
        <p className="font-medium">{row.original.name}</p>
      </div>
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
  const navigate = useNavigate();
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,   // TanStack Table is 0-indexed
    pageSize: 20,
  });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Server-side pagination — API is 1-indexed
  const { data, isLoading, error } = useTeams(
    pagination.pageIndex + 1,
    pagination.pageSize,
    false,
    search
  );

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleNavigate = useCallback(
    (teamId: string) => {
      navigate(buildRoute(ROUTES.TEAM_DETAIL, { teamId }));
    },
    [navigate]
  );

  // Safe data access — never pass undefined
  const teams = data?.items ?? [];
  const pageCount = data?.pagination?.totalPages ?? 0;
  const totalCount = data?.pagination?.total ?? 0;

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
            <CardTitle>All Teams ({totalCount})</CardTitle>
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
                emptyMessage="No teams found."
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLoader>
  );
}
```

### 2. Detail Page (Info Card + Tabs)

```typescript
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/PageLoader';
import { MemberInfoCard } from '../components/MemberInfoCard';
import { MemberCheckInTable } from '../components/MemberCheckInTable';
import { MemberMissedCheckInTable } from '../components/MemberMissedCheckInTable';
import { usePerson } from '@/features/person/hooks/usePersons';

export function TeamWorkerDetailPage() {
  const { workerId } = useParams<{ workerId: string }>();
  const navigate = useNavigate();

  const { data: person, isLoading, error } = usePerson(workerId!);

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="detail">
      <div className="space-y-6">
        <PageHeader
          title={`${person?.first_name} ${person?.last_name}`}
          description="Team member details and check-in history"
          action={
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          }
        />

        {/* Info card — always visible at top, never inside a tab */}
        <MemberInfoCard person={person!} />

        {/* Data tabs — below the info card */}
        <Tabs defaultValue="check-ins">
          <TabsList>
            <TabsTrigger value="check-ins">Check-In Records</TabsTrigger>
            <TabsTrigger value="missed">Missed Check-Ins</TabsTrigger>
          </TabsList>
          <TabsContent value="check-ins">
            <MemberCheckInTable personId={person!.id} />
          </TabsContent>
          <TabsContent value="missed">
            <MemberMissedCheckInTable personId={person!.id} />
          </TabsContent>
        </Tabs>
      </div>
    </PageLoader>
  );
}
```

### 3. Dashboard Page (StatCards + Sub-Components)

```typescript
import { AlertTriangle, FolderOpen, Briefcase, CheckCircle } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/PageLoader';
import { StatCard } from '../components/StatCard';
import { PendingIncidentsTable } from '../components/whs/PendingIncidentsTable';
import { CasesByStatus } from '../components/whs/CasesByStatus';
import { RecentActivity } from '../components/whs/RecentActivity';
import { useWhsDashboardStats } from '../hooks/useDashboardStats';

export function WhsDashboard() {
  const { data, isLoading, error } = useWhsDashboardStats();

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="dashboard">
      <div className="space-y-6">
        <PageHeader title="WHS Dashboard" description="Incident monitoring overview" />

        {/* Row 1: Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Pending Incidents"
            value={data?.pendingIncidentsCount ?? 0}
            icon={<AlertTriangle className="h-4 w-4" />}
            description="Awaiting your review"
            iconBgColor="orange"
          />
          <StatCard
            title="My Open Cases"
            value={data?.myCasesCount ?? 0}
            icon={<FolderOpen className="h-4 w-4" />}
            description="Assigned to you"
            iconBgColor="blue"
          />
          {/* ... more stat cards */}
        </div>

        {/* Row 2: Full-width component */}
        <PendingIncidentsTable incidents={data?.pendingIncidents ?? []} />

        {/* Row 3: Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CasesByStatus casesByStatus={data?.casesByStatus ?? {}} />
          <RecentActivity events={data?.recentActivity ?? []} />
        </div>
      </div>
    </PageLoader>
  );
}
```

### 4. Analytics Page (Period Selector + Charts)

```typescript
import { useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/PageLoader';
import { Button } from '@/components/ui/button';
import { StatCard } from '../components/StatCard';
import { IncidentTrendChart } from '../components/whs-analytics/IncidentTrendChart';
import { IncidentTypeChart } from '../components/whs-analytics/IncidentTypeChart';
import { useWhsAnalytics } from '../hooks/useWhsAnalytics';
import { cn } from '@/lib/utils/cn';
import type { AnalyticsPeriod } from '@/types/whs-analytics.types';

const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

export function WhsAnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const { data, isLoading, error } = useWhsAnalytics(period);

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="dashboard">
      <div className="space-y-6">
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

        {/* Charts in responsive grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <IncidentTrendChart data={data?.incidentTrends ?? []} />
          <IncidentTypeChart data={data?.incidentsByType ?? []} />
        </div>

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard title="Total Incidents" value={data?.summary?.totalIncidents ?? 0} />
          <StatCard title="Cases Created" value={data?.summary?.totalCasesCreated ?? 0} />
          {/* ... more stat cards */}
        </div>
      </div>
    </PageLoader>
  );
}
```

## Page Composition Summary

| Page Type | Skeleton | Structure |
|-----------|----------|-----------|
| **List** | `"table"` | `PageLoader > space-y-6 > PageHeader > Card > TableSearch + DataTable` |
| **Detail** | `"detail"` | `PageLoader > space-y-6 > PageHeader (+ back btn) > InfoCard > Tabs` |
| **Dashboard** | `"dashboard"` | `PageLoader > space-y-6 > PageHeader > StatCards grid > Sub-components` |
| **Analytics** | `"dashboard"` | `PageLoader > space-y-6 > PageHeader (+ period selector) > Charts grid > StatCards` |
| **Create/Edit** | N/A | `space-y-6 > PageHeader (+ back btn) > Card > Form` |

## Rules

- ✅ **DO** wrap every page with `PageLoader` for loading/error states
- ✅ **DO** use `PageHeader` at the top of every page
- ✅ **DO** use `space-y-6` for page sections spacing
- ✅ **DO** use `data?.items ?? []` for safe data access (never pass undefined)
- ✅ **DO** use `data?.pagination?.totalPages ?? 0` for pageCount
- ✅ **DO** place info cards ABOVE tabs (never inside a tab)
- ✅ **DO** pass data as props to dashboard sub-components (one fetch per dashboard)
- ✅ **DO** use the appropriate skeleton type for each page type
- ❌ **NEVER** build custom loading states (use `PageLoader`)
- ❌ **NEVER** pass `undefined` data to child components (use `?? []` or `?? 0`)
- ❌ **NEVER** fetch data inside dashboard sub-components (pass via props)
- ❌ **NEVER** skip `PageHeader` at the top of a page
- ❌ **NEVER** use `space-y-4` or `space-y-8` for page-level spacing (always `space-y-6`)

## Common Mistakes

### WRONG: No PageLoader wrapper
```typescript
export function TeamsPage() {
  const { data, isLoading, error } = useTeams(1, 20);

  // WRONG - manual loading/error handling
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>Teams</h1>
      {/* content */}
    </div>
  );
}
```

### CORRECT: PageLoader with skeleton
```typescript
export function TeamsPage() {
  const { data, isLoading, error } = useTeams(1, 20);

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <div className="space-y-6">
        <PageHeader title="Teams" description="Manage your teams" />
        {/* content using data?.items ?? [] */}
      </div>
    </PageLoader>
  );
}
```

### WRONG: Passing undefined data
```typescript
<DataTable
  columns={columns}
  data={data?.items}           // WRONG - can be undefined
  pageCount={data?.pagination?.totalPages}  // WRONG - can be undefined
/>
<PendingIncidentsTable incidents={data?.pendingIncidents} />  // WRONG
```

### CORRECT: Safe data access with fallbacks
```typescript
<DataTable
  columns={columns}
  data={data?.items ?? []}                    // CORRECT - always an array
  pageCount={data?.pagination?.totalPages ?? 0}  // CORRECT - always a number
/>
<PendingIncidentsTable incidents={data?.pendingIncidents ?? []} />  // CORRECT
```

### WRONG: Missing PageHeader
```typescript
export function TeamsPage() {
  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <div className="space-y-6">
        {/* WRONG - no PageHeader, just a raw h1 */}
        <h1 className="text-3xl font-bold">Teams</h1>
        <DataTable columns={columns} data={data?.items ?? []} />
      </div>
    </PageLoader>
  );
}
```

### CORRECT: PageHeader at top
```typescript
export function TeamsPage() {
  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <div className="space-y-6">
        <PageHeader
          title="Teams"
          description="Manage your teams and team members"
          action={<Button><Plus className="mr-2 h-4 w-4" />Create Team</Button>}
        />
        <DataTable columns={columns} data={data?.items ?? []} />
      </div>
    </PageLoader>
  );
}
```

### WRONG: Sub-components fetching their own data
```typescript
// WRONG - each sub-component makes its own API call
export function WhsDashboard() {
  return (
    <div className="space-y-6">
      <PendingIncidentsTable />   {/* fetches own data */}
      <CasesByStatus />           {/* fetches own data */}
      <RecentActivity />          {/* fetches own data */}
    </div>
  );
}
```

### CORRECT: One fetch, pass data as props
```typescript
export function WhsDashboard() {
  const { data, isLoading, error } = useWhsDashboardStats();

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="dashboard">
      <div className="space-y-6">
        <PageHeader title="WHS Dashboard" />
        <PendingIncidentsTable incidents={data?.pendingIncidents ?? []} />
        <CasesByStatus casesByStatus={data?.casesByStatus ?? {}} />
        <RecentActivity events={data?.recentActivity ?? []} />
      </div>
    </PageLoader>
  );
}
```


## StatCard Component Reference

<!-- BUILT FROM: .ai/patterns/ui/component-usage.md -->
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


## Query Hook Pattern

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


## Checklist for New Dashboard

1. Create `src/types/<role>-dashboard.types.ts` — response types
2. Add hook to `src/features/dashboard/hooks/useDashboardStats.ts`
3. Add endpoint to `src/lib/api/endpoints.ts` → `DASHBOARD.<ROLE>`
4. Create sub-components in `src/features/dashboard/components/<role>/`
5. Create page in `src/features/dashboard/pages/<Role>Dashboard.tsx`
6. Add case to `src/features/dashboard/pages/Dashboard.tsx`
7. Backend: create `src/modules/dashboard/<role>-dashboard.service.ts`
8. Backend: add controller function + route in dashboard module
9. Ensure mutation hooks invalidate `{ queryKey: ['dashboard'] }` on relevant actions

## Key Rules

- ONE hook, ONE endpoint, ONE fetch per dashboard — sub-components receive data as props
- ALWAYS use `STALE_TIMES.STANDARD` (2min) for operational dashboards
- ALWAYS use `PageLoader` with `skeleton="dashboard"`
- ALWAYS use `StatCard` from `features/dashboard/components/StatCard.tsx` — never recreate
- ALWAYS use `Promise.all` in backend services (parallel queries)
- ALWAYS filter by `company_id` (multi-tenant)
- Sub-component tables use `<Table>` (shadcn/ui), NOT `DataTable` (no pagination needed)
- Activity feed events should have `actionUrl` for clickable navigation
