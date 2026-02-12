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
