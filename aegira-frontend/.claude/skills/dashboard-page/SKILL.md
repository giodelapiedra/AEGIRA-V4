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

## Types File

```typescript
// src/types/<role>-dashboard.types.ts

export interface RoleDashboardStats {
  // Summary counts (for StatCards)
  pendingCount: number;
  activeCount: number;
  resolvedCount: number;
  totalCount: number;

  // Breakdown data (for sub-components)
  statusBreakdown: {
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
  };

  // List data (for tables)
  recentItems: RecentItem[];

  // Activity feed
  recentActivity: ActivityEvent[];
}

export interface RecentItem {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  actionUrl?: string;
}
```

## Query Hook (add to existing useDashboardStats.ts)

```typescript
// Add to src/features/dashboard/hooks/useDashboardStats.ts

import type { RoleDashboardStats } from '@/types/<role>-dashboard.types';
export type { RoleDashboardStats } from '@/types/<role>-dashboard.types';

/**
 * <Role> dashboard stats
 * GET /api/v1/dashboard/<role>
 */
export function use<Role>DashboardStats() {
  return useQuery({
    queryKey: ['dashboard', '<role>'],
    staleTime: STALE_TIMES.STANDARD,  // 2min — operational data
    queryFn: () => apiClient.get<RoleDashboardStats>(ENDPOINTS.DASHBOARD.<ROLE>),
  });
}
```

## Dashboard Page Template

```typescript
// src/features/dashboard/pages/<Role>Dashboard.tsx

import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/PageLoader';
import {
  AlertTriangle,
  FolderOpen,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { SummaryTable } from '../components/<role>/SummaryTable';
import { StatusBreakdown } from '../components/<role>/StatusBreakdown';
import { ActivityFeed } from '../components/<role>/ActivityFeed';
import { use<Role>DashboardStats } from '../hooks/useDashboardStats';

export function <Role>Dashboard() {
  const { data, isLoading, error } = use<Role>DashboardStats();

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="dashboard">
      <div className="space-y-6">
        <PageHeader
          title="<Role> Dashboard"
          description="Operational overview"
        />

        {/* Row 1: StatCards with icons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Pending"
            value={String(data?.pendingCount ?? 0)}
            icon={<AlertTriangle className="h-5 w-5" />}
            iconBgColor="orange"
            description="Awaiting review"
          />
          <StatCard
            title="Active"
            value={String(data?.activeCount ?? 0)}
            icon={<FolderOpen className="h-5 w-5" />}
            iconBgColor="blue"
            description="Currently in progress"
          />
          <StatCard
            title="Total Open"
            value={String(data?.totalCount ?? 0)}
            icon={<Clock className="h-5 w-5" />}
            iconBgColor="purple"
          />
          <StatCard
            title="Resolved"
            value={String(data?.resolvedCount ?? 0)}
            icon={<CheckCircle2 className="h-5 w-5" />}
            iconBgColor="green"
            description="This month"
          />
        </div>

        {/* Row 2: Primary content (full width) */}
        <SummaryTable items={data?.recentItems ?? []} />

        {/* Row 3: Secondary content (2 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StatusBreakdown data={data?.statusBreakdown} />
          <ActivityFeed events={data?.recentActivity ?? []} />
        </div>
      </div>
    </PageLoader>
  );
}
```

## StatCard Component (already exists)

```typescript
// src/features/dashboard/components/StatCard.tsx
// Reusable — DO NOT recreate, import from here

interface StatCardProps {
  title: string;
  value: string;
  icon?: React.ReactNode;
  description?: string;
  iconBgColor?: 'blue' | 'green' | 'purple' | 'orange';
}
```

Usage:
- **With icon** (dashboard): `<StatCard title="Pending" value="5" icon={<AlertTriangle />} iconBgColor="orange" />`
- **Without icon** (analytics): `<StatCard title="Total" value="142" />`

## Activity Feed Component Template

```typescript
// src/features/dashboard/components/<role>/ActivityFeed.tsx

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/common/EmptyState';
import { useNavigate } from 'react-router-dom';
import { getRelativeTime } from '@/lib/utils/date.utils';

const EVENT_DOT_COLORS: Record<string, string> = {
  CREATED: 'bg-yellow-400',
  APPROVED: 'bg-green-400',
  REJECTED: 'bg-red-400',
  UPDATED: 'bg-purple-400',
  RESOLVED: 'bg-green-500',
};

interface ActivityEvent {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  actionUrl?: string;
}

interface ActivityFeedProps {
  events: ActivityEvent[];
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <EmptyState message="No recent activity" />
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {events.map((event) => (
              <div
                key={event.id}
                className={`flex items-start gap-3 ${event.actionUrl ? 'cursor-pointer hover:bg-muted/50 rounded-md p-2 -m-2' : ''}`}
                onClick={() => event.actionUrl && navigate(event.actionUrl)}
              >
                <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${EVENT_DOT_COLORS[event.type] ?? 'bg-gray-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{event.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {getRelativeTime(event.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

## Register in Dashboard.tsx

After creating a new role dashboard, add it to the role switch:

```typescript
// src/features/dashboard/pages/Dashboard.tsx

import { <Role>Dashboard } from './<Role>Dashboard';

switch (user.role) {
  case 'ADMIN':
    return <AdminDashboard />;
  case 'WHS':
    return <WhsDashboard />;
  case '<ROLE>':
    return <<Role>Dashboard />;  // ← Add new case
  // ...
}
```

## Backend Service Pattern (for dashboard endpoints)

Dashboard services use a class-based pattern (not the standard repository pattern):

```typescript
// src/modules/dashboard/<role>-dashboard.service.ts

import { prisma } from '../../config/database';
import { DateTime } from 'luxon';

export class <Role>DashboardService {
  constructor(
    private readonly companyId: string,
    private readonly timezone: string = 'Asia/Manila'
  ) {}

  async getDashboard(personId: string) {
    // Run all independent queries in parallel
    const [count1, count2, items, events] = await Promise.all([
      prisma.model.count({ where: { company_id: this.companyId, ... } }),
      prisma.model.count({ where: { company_id: this.companyId, ... } }),
      prisma.model.findMany({ where: { ... }, take: 5, orderBy: { ... } }),
      prisma.event.findMany({ where: { ... }, take: 10, orderBy: { created_at: 'desc' } }),
    ]);

    return { count1, count2, items, events };
  }
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
- ALWAYS add `queryClient.invalidateQueries({ queryKey: ['dashboard'] })` in related mutation hooks
- ALWAYS group sub-components in `components/<role>/` directory
- Add the dashboard hook to the EXISTING `useDashboardStats.ts` file (don't create a separate file)
- Dashboard.tsx role switch renders the correct dashboard — no separate routes needed
- Sub-component tables use `<Table>` (shadcn/ui), NOT `DataTable` (no pagination needed for top-5/10 lists)
- Activity feed events should have `actionUrl` for clickable navigation
