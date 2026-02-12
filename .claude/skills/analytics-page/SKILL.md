---
name: analytics-page
description: Generate a chart-based analytics page for AEGIRA frontend. Use when creating pages with period selectors, Recharts charts (area, pie/donut), centralized color config, and summary StatCards.
---
# Analytics Page (Charts + Period Selector)

Analytics pages display historical trends and distributions using Recharts. They use a period selector (7d/30d/90d) and centralized chart color config.

## File Structure

```
aegira-frontend/src/features/<feature>/
├── pages/
│   └── <Feature>AnalyticsPage.tsx        # Page with period selector + chart grid
├── components/
│   └── <feature>-analytics/
│       ├── chartConfig.ts                # Centralized color constants
│       ├── TrendChart.tsx                 # Area chart (time series)
│       ├── TypeDistributionChart.tsx      # Donut pie chart
│       └── BreakdownTable.tsx             # Simple table (no DataTable)
├── hooks/
│   └── use<Feature>Analytics.ts          # Query hook with period param
└── (types in src/types/<feature>-analytics.types.ts)
```

## Analytics Page Pattern

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


## Chart Patterns

<!-- BUILT FROM: .ai/patterns/ui/chart-patterns.md -->
# Chart Patterns
> Recharts AreaChart and PieChart/Donut patterns with theme tokens, EmptyState fallback, and centralized colors

## When to Use
- Analytics pages with historical trends (AreaChart)
- Distribution breakdowns (PieChart/Donut)
- Dashboard widgets with visual data representation
- Any page that renders time-series or categorical chart data

## Canonical Implementation

### AreaChart Pattern (Time Series)
```tsx
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/common/EmptyState';
import { TrendingUp } from 'lucide-react';
import { STATUS_COLORS } from './chartConfig';

interface TrendChartProps {
  data: { date: string; total: number; approved: number }[];
}

export function TrendChart({ data }: TrendChartProps) {
  const hasData = data.length > 0;
  const total = data.reduce((sum, d) => sum + d.total, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Incident Trends
        </CardTitle>
        <span className="text-2xl font-bold tabular-nums">{total}</span>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyState
            title="No trend data"
            description="No incidents recorded in this period"
            icon={<TrendingUp className="h-10 w-10" />}
          />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data} margin={{ top: 0, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gradTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={STATUS_COLORS.total} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={STATUS_COLORS.total} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  strokeOpacity={0.5}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(val: string) => {
                    const d = new Date(val);
                    return `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`;
                  }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke={STATUS_COLORS.total}
                  strokeWidth={2}
                  fill="url(#gradTrend)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: STATUS_COLORS.total }}
                />
              </AreaChart>
            </ResponsiveContainer>

            {/* Legend row */}
            <div className="flex items-center justify-center gap-4 pt-2">
              {(['total', 'approved', 'rejected'] as const).map((key) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[key] }}
                  />
                  <span className="text-xs text-muted-foreground capitalize">{key}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

### PieChart / Donut Pattern (Distribution)
```tsx
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/common/EmptyState';
import { AlertTriangle } from 'lucide-react';
import { SEVERITY_COLORS, SEVERITY_LABELS } from './chartConfig';

interface DistributionChartProps {
  data: { severity: string; count: number }[];
}

export function DistributionChart({ data }: DistributionChartProps) {
  const hasData = data.length > 0;
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Severity Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyState
            title="No data"
            description="No incidents in this period"
            icon={<AlertTriangle className="h-10 w-10" />}
          />
        ) : (
          <div className="flex items-center gap-6">
            {/* Donut chart: 180x180, innerRadius=55, outerRadius=85 */}
            <div className="relative shrink-0 w-[180px] h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="count"
                    nameKey="severity"
                    paddingAngle={2}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                  >
                    {data.map((entry) => (
                      <Cell
                        key={entry.severity}
                        fill={SEVERITY_COLORS[entry.severity] ?? '#cbd5e1'}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold">{total}</span>
                <span className="text-xs text-muted-foreground">Total</span>
              </div>
            </div>

            {/* Legend list */}
            <div className="flex-1 space-y-2.5">
              {data.map((entry) => (
                <div key={entry.severity} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: SEVERITY_COLORS[entry.severity] ?? '#cbd5e1' }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {SEVERITY_LABELS[entry.severity] ?? entry.severity}
                    </span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{entry.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Chart Color Config (Centralized)
```typescript
// Located at: features/dashboard/components/whs-analytics/chartConfig.ts

// Soft pastel palette (300-400 shades)
export const SEVERITY_COLORS: Record<string, string> = {
  LOW: '#93c5fd',      // blue-300
  MEDIUM: '#fcd34d',   // amber-300
  HIGH: '#fdba74',     // orange-300
  CRITICAL: '#fca5a5', // red-300
};

export const STATUS_COLORS: Record<string, string> = {
  total: '#6366f1',    // indigo-500
  approved: '#34d399', // emerald-400
  rejected: '#f87171', // red-400
  pending: '#fbbf24',  // amber-400
};

export const INCIDENT_TYPE_COLORS: Record<string, string> = {
  PHYSICAL_INJURY: '#fca5a5',
  ILLNESS_SICKNESS: '#fdba74',
  MENTAL_HEALTH: '#d8b4fe',
  MEDICAL_EMERGENCY: '#f87171',
  HEALTH_SAFETY_CONCERN: '#fcd34d',
  OTHER: '#cbd5e1',
};

export const SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};
```

### Period Selector Button Group
```tsx
import { cn } from '@/lib/utils/cn';
import type { AnalyticsPeriod } from '@/types/whs-analytics.types';

const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

// Used in PageHeader action slot
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
```

### Stacked Area Chart (Multiple Series)
```tsx
{/* Each series uses fillOpacity=0.1 and stackId for stacking */}
<Area
  type="monotone"
  dataKey="approved"
  stroke={STATUS_COLORS.approved}
  strokeWidth={1.5}
  fill={STATUS_COLORS.approved}
  fillOpacity={0.1}
  dot={false}
  activeDot={{ r: 3, strokeWidth: 0, fill: STATUS_COLORS.approved }}
  stackId="status"
/>
<Area
  type="monotone"
  dataKey="rejected"
  stroke={STATUS_COLORS.rejected}
  strokeWidth={1.5}
  fill={STATUS_COLORS.rejected}
  fillOpacity={0.1}
  dot={false}
  activeDot={{ r: 3, strokeWidth: 0, fill: STATUS_COLORS.rejected }}
  stackId="status"
/>
{/* Overlay line (not stacked, no stackId) */}
<Area
  type="monotone"
  dataKey="total"
  stroke={STATUS_COLORS.total}
  strokeWidth={2}
  fill="url(#gradTrend)"
  dot={false}
  activeDot={{ r: 4, strokeWidth: 0, fill: STATUS_COLORS.total }}
/>
```

## Rules
- ✅ DO use `ResponsiveContainer` with `width="100%"` for all charts
- ✅ DO use theme tokens for grid/axis/tooltip: `hsl(var(--border))`, `hsl(var(--muted-foreground))`, `hsl(var(--card))`
- ✅ DO wrap every chart in a `Card` with `EmptyState` fallback when `data.length === 0`
- ✅ DO centralize colors in a `chartConfig.ts` file per feature
- ✅ DO use soft pastel palette (300-400 Tailwind shades) for chart colors
- ✅ DO use standard chart height of 260px for AreaCharts
- ✅ DO use standard donut size: `w-[180px] h-[180px]`, `innerRadius={55}`, `outerRadius={85}`
- ✅ DO hide axis lines and tick lines: `axisLine={false}` `tickLine={false}`
- ✅ DO hide dots on Area: `dot={false}`, show only `activeDot`
- ✅ DO use `vertical={false}` on CartesianGrid (horizontal lines only)
- ✅ DO use `tabular-nums` class for numeric values in legends
- ✅ DO add a legend row below AreaCharts with colored circles
- ✅ DO use absolute positioned center label for donuts
- ✅ DO use `paddingAngle={2}` and `stroke="hsl(var(--card))"` on Pie for visual separation
- ❌ NEVER hardcode colors inline in chart components (use chartConfig)
- ❌ NEVER use raw hex colors for grid/axis/tooltip (use `hsl(var(--token))`)
- ❌ NEVER render a chart without an EmptyState fallback
- ❌ NEVER use fixed pixel widths on ResponsiveContainer (always `width="100%"`)
- ❌ NEVER put chart colors in individual chart files (centralize in chartConfig.ts)

## Common Mistakes

### ❌ WRONG: Hardcoded colors in chart component
```tsx
<Area
  dataKey="total"
  stroke="#6366f1"     // Hardcoded hex
  fill="#6366f1"
/>
<CartesianGrid stroke="#e5e7eb" />  // Hardcoded gray
```

### ✅ CORRECT: Centralized colors + theme tokens
```tsx
import { STATUS_COLORS } from './chartConfig';

<Area
  dataKey="total"
  stroke={STATUS_COLORS.total}        // From chartConfig
  fill={STATUS_COLORS.total}
/>
<CartesianGrid stroke="hsl(var(--border))" />  // Theme token
```

### ❌ WRONG: No empty state fallback
```tsx
export function TrendChart({ data }: TrendChartProps) {
  return (
    <Card>
      <CardContent>
        {/* Crashes or renders empty chart when data=[] */}
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data}>
            {/* ... */}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

### ✅ CORRECT: EmptyState fallback
```tsx
export function TrendChart({ data }: TrendChartProps) {
  const hasData = data.length > 0;

  return (
    <Card>
      <CardContent>
        {!hasData ? (
          <EmptyState
            title="No trend data"
            description="No data recorded in this period"
            icon={<TrendingUp className="h-10 w-10" />}
          />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data}>
              {/* ... */}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
```

### ❌ WRONG: Fixed width container
```tsx
<ResponsiveContainer width={600} height={260}>
  <AreaChart data={data}>{/* ... */}</AreaChart>
</ResponsiveContainer>
```

### ✅ CORRECT: Percentage width
```tsx
<ResponsiveContainer width="100%" height={260}>
  <AreaChart data={data}>{/* ... */}</AreaChart>
</ResponsiveContainer>
```

### ❌ WRONG: Non-standard donut dimensions
```tsx
<div className="w-[250px] h-[250px]">
  <PieChart>
    <Pie innerRadius={40} outerRadius={100} />
  </PieChart>
</div>
```

### ✅ CORRECT: Standard donut dimensions
```tsx
<div className="relative shrink-0 w-[180px] h-[180px]">
  <ResponsiveContainer width="100%" height="100%">
    <PieChart>
      <Pie innerRadius={55} outerRadius={85} paddingAngle={2} />
    </PieChart>
  </ResponsiveContainer>
</div>
```


## Design Tokens (Chart Colors)

<!-- BUILT FROM: .ai/patterns/ui/design-tokens.md -->
# Design Tokens
> Typography scale, color tokens, border opacities, and status colors - NEVER use arbitrary values or hardcoded colors

## Typography Scale

**ALWAYS use Tailwind scale - NEVER use arbitrary values like `text-[11px]`**

```tsx
// ✅ CORRECT - Use Tailwind scale
<p className="text-xs">Small text (0.75rem / 12px)</p>
<p className="text-sm">Body text (0.875rem / 14px)</p>
<p className="text-base">Base text (1rem / 16px)</p>
<p className="text-lg">Large text (1.125rem / 18px)</p>
<p className="text-xl">Extra large (1.25rem / 20px)</p>
<p className="text-2xl">Heading (1.5rem / 24px)</p>
<p className="text-3xl">Large heading (1.875rem / 30px)</p>
<p className="text-4xl">Hero (2.25rem / 36px)</p>

// ❌ WRONG - Arbitrary values
<p className="text-[11px]">Never do this</p>
<p className="text-[15px]">Never do this</p>
```

### Font Weights

```tsx
font-normal    // 400
font-medium    // 500
font-semibold  // 600
font-bold      // 700
```

### Tabular Numbers

Use `tabular-nums` for numeric alignment in tables:

```tsx
<td className="tabular-nums">{score}</td>
<td className="tabular-nums">{percentage}%</td>
```

## Color Tokens

**ALWAYS use semantic color tokens - NEVER hardcode `gray-*` colors**

### Foreground Colors

```tsx
// ✅ CORRECT - Semantic tokens
text-foreground           // Primary text (black in light, white in dark)
text-muted-foreground     // Secondary text (gray-500 in light, gray-400 in dark)
text-primary              // Brand color text
text-destructive          // Error/danger text
text-success              // Success text (for custom config)

// ❌ WRONG - Hardcoded grays
text-gray-900  // Never hardcode
text-gray-500  // Use text-muted-foreground instead
text-gray-400  // Use text-muted-foreground instead
```

### Background Colors

```tsx
// ✅ CORRECT
bg-background       // Page background
bg-card             // Card/container background
bg-muted            // Subtle background (for disabled, hover states)
bg-accent           // Accent background (for hover)
bg-primary          // Brand color background
bg-destructive      // Error/danger background
bg-success          // Success background (for custom config)
bg-secondary        // Secondary background

// ❌ WRONG
bg-gray-50   // Never hardcode
bg-gray-100  // Use bg-muted instead
```

### Border Colors

```tsx
// ✅ CORRECT
border-border       // Default border color
border-input        // Input border color
border-primary      // Brand color border
border-destructive  // Error border

// ❌ WRONG
border-gray-200  // Never hardcode
border-gray-300  // Use border-border instead
```

## Border Opacities

**ONLY use `/50` (subtle) or `/70` (container) - NEVER `/40` or `/60`**

```tsx
// ✅ CORRECT - Only two allowed values
border-border/50   // Subtle borders (list separators, dividers)
border-border/70   // Container borders (cards, modals)

// ❌ WRONG - Invalid opacities
border-border/40   // Never use
border-border/60   // Never use
border-border/80   // Never use

// Usage examples
<div className="border border-border/70 rounded-lg">Card</div>
<tr className="border-b border-border/50">Row</tr>
```

## Status Colors

**Active = `success`, Inactive = `secondary` - NEVER `destructive` for inactive**

```tsx
// ✅ CORRECT - Status badge variants
<Badge variant="success">Active</Badge>
<Badge variant="secondary">Inactive</Badge>
<Badge variant="destructive">Deleted</Badge>
<Badge variant="warning">Pending</Badge>

// ❌ WRONG
<Badge variant="destructive">Inactive</Badge>  // Too aggressive for inactive
<Badge variant="default">Active</Badge>        // Not semantic enough
```

### Status Color Mapping

```tsx
const statusVariants = {
  active: 'success',      // Green
  inactive: 'secondary',  // Gray
  deleted: 'destructive', // Red
  pending: 'warning',     // Yellow/Orange
  approved: 'success',    // Green
  rejected: 'destructive', // Red
} as const;
```

## Role Colors

**Use RoleBadge component - NEVER inline variant maps**

```tsx
// ✅ CORRECT - Use RoleBadge component
import { RoleBadge } from '@/components/common/RoleBadge';
<RoleBadge role={person.role} />

// ❌ WRONG - Inline variant maps
const roleVariant = role === 'ADMIN' ? 'destructive' : 'default';
<Badge variant={roleVariant}>{role}</Badge>
```

### Role Color Reference

```tsx
// Internal to RoleBadge component
const roleVariants = {
  ADMIN: 'destructive',      // Red
  WHS: 'default',            // Blue
  SUPERVISOR: 'secondary',   // Gray
  TEAM_LEAD: 'outline',      // White with border
  WORKER: 'success',         // Green
} as const;
```

## Chart Colors

**Soft pastel palette - consistent across all charts**

```tsx
// Centralized in src/config/chartConfig.ts
export const CHART_COLORS = {
  primary: 'hsl(var(--chart-1))',      // Soft blue
  secondary: 'hsl(var(--chart-2))',    // Soft green
  tertiary: 'hsl(var(--chart-3))',     // Soft purple
  quaternary: 'hsl(var(--chart-4))',   // Soft orange
  quinary: 'hsl(var(--chart-5))',      // Soft pink
} as const;

// Usage in chartConfig
export const incidentTrendConfig = {
  incidents: {
    label: 'Incidents',
    color: CHART_COLORS.primary,
  },
  resolved: {
    label: 'Resolved',
    color: CHART_COLORS.secondary,
  },
} satisfies ChartConfig;
```

## Theme Token Examples

### Card Component

```tsx
// ✅ CORRECT - Uses semantic tokens
<Card className="border-border/70">
  <CardHeader>
    <CardTitle className="text-foreground">Title</CardTitle>
    <CardDescription className="text-muted-foreground">
      Description
    </CardDescription>
  </CardHeader>
</Card>

// ❌ WRONG - Hardcoded colors
<div className="border border-gray-200 bg-white">
  <h3 className="text-gray-900">Title</h3>
  <p className="text-gray-500">Description</p>
</div>
```

### Button Variants

```tsx
<Button variant="default">Primary</Button>      // bg-primary
<Button variant="secondary">Secondary</Button>  // bg-secondary
<Button variant="destructive">Delete</Button>   // bg-destructive
<Button variant="outline">Cancel</Button>       // border-input
<Button variant="ghost">Ghost</Button>          // transparent
```

### Input Component

```tsx
// ✅ CORRECT - Uses semantic tokens
<Input
  className="border-input focus:border-primary text-foreground"
  placeholder="Enter text"
/>

// ❌ WRONG
<input className="border-gray-300 text-gray-900" />
```

## Rules

- ✅ DO use Tailwind typography scale (`text-xs`, `text-sm`, `text-base`)
- ✅ DO use semantic color tokens (`text-foreground`, `text-muted-foreground`)
- ✅ DO use border opacities `/50` (subtle) or `/70` (container) ONLY
- ✅ DO use `variant="success"` for active status
- ✅ DO use `variant="secondary"` for inactive status
- ✅ DO use `tabular-nums` for numeric alignment in tables
- ✅ DO use RoleBadge component for role colors
- ✅ DO use CHART_COLORS from chartConfig.ts for charts
- ❌ NEVER use arbitrary font sizes like `text-[11px]` or `text-[15px]`
- ❌ NEVER hardcode gray colors like `text-gray-500` or `bg-gray-100`
- ❌ NEVER use border opacities other than `/50` or `/70`
- ❌ NEVER use `variant="destructive"` for inactive status
- ❌ NEVER inline role variant maps - use RoleBadge component
- ❌ NEVER use hardcoded hex colors for charts - use CHART_COLORS


## Checklist

- [ ] Uses `keepPreviousData` in the analytics query hook
- [ ] Uses `STALE_TIMES.STATIC` (10min) for historical analytics data
- [ ] Centralizes chart colors in `chartConfig.ts`
- [ ] Each chart wrapped in `Card` with `CardHeader` + `CardTitle`
- [ ] Provides `EmptyState` fallback when data is empty
- [ ] Uses `ResponsiveContainer` wrapping all Recharts charts
- [ ] Passes `data ?? []` to chart components (never undefined)
- [ ] `AnalyticsPeriod` type defined as `'7d' | '30d' | '90d'`
- [ ] Period selector in PageHeader's `action` slot
- [ ] Uses `cn()` for conditional button styling
- [ ] Soft pastel colors matching shadcn/ui design
