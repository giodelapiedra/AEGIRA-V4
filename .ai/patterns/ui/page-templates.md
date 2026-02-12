# Page Structure Templates
> Standard layouts for list, detail, form, dashboard, and analytics pages with responsive grids

## When to Use
- When creating any new page in the frontend
- When following the composition structure for consistent layouts
- When adding responsive grid layouts for stat cards, charts, or form sections

## Canonical Implementation

### List Page Template
The most common page type. Shows a table with search and pagination.

```
Structure: PageLoader > space-y-6 > PageHeader > Card > TableSearch > DataTable
```

```tsx
import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Plus, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageLoader } from '@/components/common/PageLoader';
import { PageHeader } from '@/components/common/PageHeader';
import { TableSearch } from '@/components/common/TableSearch';
import { useTeams, type Team } from '../hooks/useTeams';
import { ROUTES } from '@/config/routes.config';
import { buildRoute } from '@/lib/utils/route.utils';

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
  // ... more columns
];

export function TeamsPage() {
  const navigate = useNavigate();
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

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
    (id: string) => navigate(buildRoute(ROUTES.TEAM_DETAIL, { teamId: id })),
    [navigate]
  );

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
              All Teams ({data?.pagination?.total ?? 0})
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
                data={data?.items ?? []}
                pageCount={data?.pagination?.totalPages}
                pagination={pagination}
                onPaginationChange={setPagination}
                isLoading={isLoading}
                totalCount={data?.pagination?.total}
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

---

### Detail Page Template
Shows entity information at top, with tabbed content below.

```
Structure: PageLoader > space-y-6 > PageHeader > Info Card > Tabs
```

```tsx
import { useParams } from 'react-router-dom';
import { PageLoader } from '@/components/common/PageLoader';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RoleBadge } from '@/components/common/RoleBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePerson } from '../hooks/usePerson';

export function PersonDetailPage() {
  const { personId } = useParams<{ personId: string }>();
  const { data: person, isLoading, error } = usePerson(personId);

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="detail">
      {person && (
        <div className="space-y-6">
          <PageHeader title={`${person.first_name} ${person.last_name}`} />

          {/* Info Card - always visible, never inside a tab */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Left: Avatar / Identity */}
                <div className="flex flex-col items-center gap-3">
                  <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-2xl font-bold text-muted-foreground">
                      {person.first_name[0]}{person.last_name[0]}
                    </span>
                  </div>
                  <RoleBadge role={person.role} />
                </div>

                {/* Right: Info sections */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{person.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={person.is_active ? 'success' : 'secondary'}>
                      {person.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs - below info card */}
          <Tabs defaultValue="check-ins">
            <TabsList>
              <TabsTrigger value="check-ins">Check-ins</TabsTrigger>
              <TabsTrigger value="incidents">Incidents</TabsTrigger>
            </TabsList>
            <TabsContent value="check-ins" className="space-y-4">
              {/* Tab content here */}
            </TabsContent>
            <TabsContent value="incidents" className="space-y-4">
              {/* Tab content here */}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </PageLoader>
  );
}
```

---

### Form Page Template (Create / Edit)
Shows a form with validation, submission, and navigation.

```
Structure: PageLoader > space-y-6 > PageHeader > Card > Form > Buttons
```

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/lib/hooks/use-toast';
import { useCreateTeam } from '../hooks/useCreateTeam';
import { ROUTES } from '@/config/routes.config';

const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100),
  description: z.string().optional(),
});

type CreateTeamForm = z.infer<typeof createTeamSchema>;

export function CreateTeamPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createTeam = useCreateTeam();

  const form = useForm<CreateTeamForm>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: { name: '', description: '' },
  });

  const onSubmit = async (data: CreateTeamForm) => {
    try {
      await createTeam.mutateAsync(data);
      toast({ title: 'Success', description: 'Team created successfully' });
      navigate(ROUTES.ADMIN_TEAMS);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create team',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Create Team" description="Add a new team to your organization" />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Team Name</Label>
              <Input id="name" {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" {...form.register('description')} />
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Creating...' : 'Create Team'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### Dashboard Page Template
Shows stat cards and sub-components with data from a single hook/endpoint.

```
Structure: PageLoader > space-y-6 > PageHeader > StatCards grid > Sub-components grid
```

```tsx
import { PageLoader } from '@/components/common/PageLoader';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/features/dashboard/components/StatCard';
import { Users, Activity, Shield, AlertTriangle } from 'lucide-react';
import { useAdminDashboard } from '../hooks/useAdminDashboard';

export function AdminDashboard() {
  const { data, isLoading, error } = useAdminDashboard();

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="dashboard">
      <div className="space-y-6">
        <PageHeader title="Admin Dashboard" description="Company-wide overview" />

        {/* Stat Cards row: responsive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Workers"
            value={data?.totalWorkers ?? 0}
            icon={<Users className="h-5 w-5" />}
            iconBgColor="blue"
          />
          <StatCard
            title="Active Teams"
            value={data?.activeTeams ?? 0}
            icon={<Shield className="h-5 w-5" />}
            iconBgColor="green"
          />
          <StatCard
            title="Avg Readiness"
            value={`${data?.avgReadiness ?? 0}%`}
            icon={<Activity className="h-5 w-5" />}
            iconBgColor="purple"
          />
          <StatCard
            title="Open Incidents"
            value={data?.openIncidents ?? 0}
            icon={<AlertTriangle className="h-5 w-5" />}
            iconBgColor="red"
          />
        </div>

        {/* Sub-components: pass data as props */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TeamOverviewTable teams={data?.teams ?? []} />
          <RecentActivityFeed activities={data?.recentActivity ?? []} />
        </div>
      </div>
    </PageLoader>
  );
}
```

---

### Analytics Page Template
Shows charts with a period selector. Uses `keepPreviousData` for smooth transitions.

```
Structure: PageLoader > space-y-6 > PageHeader (with period selector) > Charts grid > StatCards grid > More charts
```

```tsx
import { useState } from 'react';
import { PageLoader } from '@/components/common/PageLoader';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/features/dashboard/components/StatCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { IncidentTrendChart } from '../components/whs-analytics/IncidentTrendChart';
import { SeverityDistributionChart } from '../components/whs-analytics/SeverityDistributionChart';
import { useWhsAnalytics } from '../hooks/useWhsAnalytics';
import { formatNumber, formatPercentage } from '@/lib/utils/format.utils';
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
        {/* PageHeader with period selector in action slot */}
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

        {/* Row 1: Charts in 2-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <IncidentTrendChart data={data?.incidentTrends ?? []} />
          <SeverityDistributionChart data={data?.incidentsBySeverity ?? []} />
        </div>

        {/* Row 2: Summary stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard title="Total Incidents" value={formatNumber(data?.summary?.total ?? 0)} />
          <StatCard title="Approval Rate" value={formatPercentage(data?.summary?.approvalRate ?? 0)} />
          {/* ... more stat cards */}
        </div>

        {/* Row 3: More charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* More chart components */}
        </div>
      </div>
    </PageLoader>
  );
}
```

## Responsive Grid Breakpoints

| Grid | Mobile | Tablet (sm) | Desktop (lg) | Use Case |
|------|--------|-------------|---------------|----------|
| `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` | 1 col | 2 cols | 4 cols | Dashboard stat cards |
| `grid-cols-2 md:grid-cols-3 lg:grid-cols-6` | 2 cols | 3 cols | 6 cols | Analytics summary stats |
| `grid-cols-1 lg:grid-cols-2` | 1 col | 1 col | 2 cols | Chart pairs |
| `grid-cols-1 sm:grid-cols-2` | 1 col | 2 cols | 2 cols | Info card sections |

## Rules
- ✅ DO use `space-y-6` for page section spacing
- ✅ DO always include mobile fallback: start with `grid-cols-1` or `grid-cols-2`
- ✅ DO use `gap-4` for card grids, `gap-6` for chart/section grids
- ✅ DO wrap page content in `PageLoader` as outermost wrapper
- ✅ DO put `PageHeader` as the first element inside `space-y-6`
- ✅ DO use `Card` + `CardContent` for form containers and table wrappers
- ✅ DO use `space-y-2` for form field + label + error groups
- ✅ DO use `space-y-4` within card content areas
- ✅ DO pass data as props to sub-components (one hook per page, not per widget)
- ✅ DO use null-coalescing for data: `data?.items ?? []`, `data?.total ?? 0`
- ❌ NEVER use `grid-cols-3` or higher without a mobile fallback (`grid-cols-1`)
- ❌ NEVER fetch data in sub-components (pass via props from the page-level hook)
- ❌ NEVER omit `PageLoader` wrapper
- ❌ NEVER use `gap-2` for page sections (too tight), or `gap-8` (too loose)
- ❌ NEVER put the info card inside a tab on detail pages

## Common Mistakes

### ❌ WRONG: No mobile fallback
```tsx
{/* Breaks on mobile - 3 columns even on small screens */}
<div className="grid grid-cols-3 gap-4">
  <StatCard title="A" value={1} />
  <StatCard title="B" value={2} />
  <StatCard title="C" value={3} />
</div>
```

### ✅ CORRECT: Mobile-first responsive grid
```tsx
{/* 1 col on mobile, 2 on tablet, 3 on desktop */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  <StatCard title="A" value={1} />
  <StatCard title="B" value={2} />
  <StatCard title="C" value={3} />
</div>
```

### ❌ WRONG: Data fetching in sub-component
```tsx
// Parent page
export function DashboardPage() {
  return <TeamOverview />;
}

// Sub-component fetches its own data
function TeamOverview() {
  const { data } = useTeams(); // BAD: separate fetch
  return <div>{/* ... */}</div>;
}
```

### ✅ CORRECT: Props from page-level hook
```tsx
// Parent page fetches all data
export function DashboardPage() {
  const { data } = useDashboard();
  return <TeamOverview teams={data?.teams ?? []} />;
}

// Sub-component receives data as props
function TeamOverview({ teams }: { teams: TeamStat[] }) {
  return <div>{/* ... */}</div>;
}
```

### ❌ WRONG: Info card inside tab on detail page
```tsx
<Tabs defaultValue="info">
  <TabsList>
    <TabsTrigger value="info">Info</TabsTrigger>
    <TabsTrigger value="history">History</TabsTrigger>
  </TabsList>
  <TabsContent value="info">
    {/* BAD: info hidden when switching tabs */}
    <InfoCard person={person} />
  </TabsContent>
  <TabsContent value="history">{/* ... */}</TabsContent>
</Tabs>
```

### ✅ CORRECT: Info card always visible above tabs
```tsx
{/* Info card always visible */}
<Card>
  <CardContent className="pt-6">
    <InfoSection person={person} />
  </CardContent>
</Card>

{/* Tabs below info card */}
<Tabs defaultValue="history">
  <TabsList>
    <TabsTrigger value="history">History</TabsTrigger>
    <TabsTrigger value="incidents">Incidents</TabsTrigger>
  </TabsList>
  <TabsContent value="history">{/* ... */}</TabsContent>
  <TabsContent value="incidents">{/* ... */}</TabsContent>
</Tabs>
```
