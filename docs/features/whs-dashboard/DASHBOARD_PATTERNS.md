# Dashboard Design Patterns

## Document Information

| Field | Value |
|-------|-------|
| **Project** | AEGIRA V5 — Workforce Readiness & WHS Management |
| **Document** | Patterns for building role-specific dashboards (applied to WHS dashboard) |
| **Version** | 3.0 |
| **Date** | 2026-02-04 |
| **Audience** | Frontend Developers, Tech Leads |

---

## Table of Contents

1. [Single-Endpoint Dashboard Pattern](#1-single-endpoint-dashboard-pattern)
2. [Component Composition Pattern](#2-component-composition-pattern)
3. [Dashboard Router Pattern](#3-dashboard-router-pattern)
4. [Caching & Invalidation](#4-caching--invalidation)
5. [Existing Pattern Adherence](#5-existing-pattern-adherence)

---

## 1. Single-Endpoint Dashboard Pattern

### 1.1 Principle

Each role-specific dashboard uses a **single backend endpoint** that returns everything the dashboard needs. This is the pattern already established by the existing dashboards:

| Dashboard | Endpoint | Returns |
|-----------|----------|---------|
| Worker | `GET /dashboard/worker` | Streak, avg readiness, schedule, weekly trend |
| Team Lead | `GET /dashboard/team-lead` | Team size, submissions, member statuses |
| Supervisor | `GET /dashboard/supervisor` | Multi-team overview, per-team metrics |
| Admin | `GET /dashboard/admin` | Workforce composition, team/worker counts |
| **WHS (new)** | **`GET /dashboard/whs`** | **Pending incidents, cases, activity** |

### 1.2 Why Single Endpoint

- Matches the pattern of all 4 existing dashboards
- One query hook, one loading state, one error state
- Backend can optimize the aggregation in a single database round-trip
- Simpler than coordinating multiple parallel queries for a lightweight dashboard

### 1.3 Hook Pattern

All dashboard hooks live in **one file**: `features/dashboard/hooks/useDashboardStats.ts`. The WHS hook is added there alongside the other 4.

```typescript
// Added to useDashboardStats.ts — follows the same pattern as existing hooks
export function useWhsDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'whs'],
    staleTime: STALE_TIMES.STANDARD,    // 2 minutes, same as Worker/TeamLead/Supervisor
    queryFn: () => apiClient.get<WhsDashboardStats>(ENDPOINTS.DASHBOARD.WHS),
  });
}
```

**Pattern notes:**
- queryKey: `['dashboard', 'whs']` — follows `['dashboard', <role>]` tuple pattern
- staleTime: `STALE_TIMES.STANDARD` — same as Worker/TeamLead/Supervisor (Admin uses STATIC)
- No `refetchOnWindowFocus` — only TeamLead has it (for real-time member status); WHS data is less volatile
- Endpoint: `ENDPOINTS.DASHBOARD.WHS` — added to existing `DASHBOARD` object in `endpoints.ts`

---

## 2. Component Composition Pattern

### 2.1 Page Composes Sections

The dashboard page fetches data once and passes it down to presentational section components:

```typescript
function WhsDashboard() {
  const { data, isLoading, error } = useWhsDashboardStats();

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="dashboard">
      {/* Stats row */}
      <StatCard value={data.pendingIncidentsCount} ... />

      {/* Sections receive data as props */}
      <PendingIncidentsTable incidents={data.pendingIncidents} />
      <CasesByStatus casesByStatus={data.casesByStatus} />
      <RecentActivity events={data.recentActivity} />
    </PageLoader>
  );
}
```

### 2.2 Section Components Are Presentational

Each section:
- Receives data via props (no internal data fetching)
- Handles its own empty state
- Is wrapped in a shadcn `<Card>`
- Is independently testable with mock props

```typescript
// Good: Section receives data
interface CasesByStatusProps {
  casesByStatus: { open: number; investigating: number; resolved: number; closed: number };
}
export function CasesByStatus({ casesByStatus }: CasesByStatusProps) { ... }

// Bad: Section fetches its own data
export function CasesByStatus() {
  const { data } = useWhsDashboardStats(); // Don't do this
}
```

### 2.3 StatCard Reuse

All dashboards use `StatCard` from `features/dashboard/components/StatCard.tsx`. The WHS dashboard follows the same pattern:

```typescript
<StatCard
  title="Pending Incidents"
  value={data?.pendingIncidentsCount || 0}
  icon={<AlertTriangle className="h-4 w-4" />}
  description="Awaiting your review"
  iconBgColor="orange"
/>
```

**StatCard prop reference (from actual component):**
```typescript
interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;          // Pass JSX: <Icon className="h-4 w-4" />
  description?: string;
  className?: string;
  iconBgColor?: 'blue' | 'green' | 'purple' | 'orange';  // default: 'blue'
}
```

---

## 3. Dashboard Router Pattern

### 3.1 Existing Pattern

`Dashboard.tsx` acts as a role-based router. It uses `useAuthStore` to get the current user and a switch/case to render the appropriate sub-dashboard:

```typescript
import { WhsDashboard } from './WhsDashboard';  // Direct import (NOT lazy)

function Dashboard() {
  const user = useAuthStore((state) => state.user);
  if (!user) return null;

  switch (user.role) {
    case 'WORKER':     return <WorkerDashboard />;
    case 'TEAM_LEAD':  return <TeamLeaderDashboard />;
    case 'SUPERVISOR': return <SupervisorDashboard />;
    case 'ADMIN':      return <AdminDashboard />;
    case 'WHS':        return <WhsDashboard />;  // ← NEW
    default:           return <WorkerDashboard />;
  }
}
```

### 3.2 All Dashboards Share `/dashboard` Route

There is no need for separate routes like `/worker-dashboard` or `/whs-dashboard`. The single `/dashboard` route handles role-based rendering. This keeps navigation simple — every user clicks "Dashboard" and sees their role-appropriate view.

### 3.3 Import Pattern

Dashboard sub-pages are imported **directly** (NOT lazy-loaded) inside `Dashboard.tsx`. The lazy loading happens at the **route level** in `routes/index.tsx`, where the `Dashboard` page itself is lazy-loaded. Individual sub-dashboards don't need their own lazy boundaries.

```typescript
// In Dashboard.tsx — direct imports (matches existing pattern)
import { WorkerDashboard } from './WorkerDashboard';
import { TeamLeaderDashboard } from './TeamLeaderDashboard';
import { SupervisorDashboard } from './SupervisorDashboard';
import { AdminDashboard } from './AdminDashboard';
import { WhsDashboard } from './WhsDashboard';  // ← NEW
```

---

## 4. Caching & Invalidation

### 4.1 Stale Time

All dashboard hooks use `['dashboard', <role>]` tuple queryKeys. Most use `STALE_TIMES.STANDARD` (2 minutes). Only TeamLead enables `refetchOnWindowFocus: true` (for real-time member status).

| Dashboard | Query Key | Stale Time | refetchOnWindowFocus |
|-----------|-----------|-----------|---------------------|
| Worker | `['dashboard', 'worker']` | STANDARD (2min) | — |
| Team Lead | `['dashboard', 'team-lead']` | STANDARD (2min) | `true` |
| Supervisor | `['dashboard', 'supervisor']` | STANDARD (2min) | — |
| Admin | `['dashboard', 'admin']` | STATIC (10min) | — |
| **WHS** | **`['dashboard', 'whs']`** | **STANDARD (2min)** | **—** |

### 4.2 Invalidation on Mutations

When the WHS officer takes actions that change the dashboard data, the cache must be invalidated. Use the **`['dashboard']` prefix** (not `['dashboard', 'whs']`) to invalidate all dashboard queries broadly — this is the established pattern used by `useDeleteTeam` and `useSubmitCheckIn`.

| Mutation | Add This Invalidation |
|----------|-----------------------|
| `useApproveIncident` | `queryClient.invalidateQueries({ queryKey: ['dashboard'] })` |
| `useRejectIncident` | `queryClient.invalidateQueries({ queryKey: ['dashboard'] })` |
| `useUpdateCase` | `queryClient.invalidateQueries({ queryKey: ['dashboard'] })` |

These mutations already invalidate their own entity queries (`['incidents']`, `['cases']`, etc.). The `['dashboard']` invalidation is **added** alongside existing invalidations.

This ensures the dashboard reflects the latest state after the officer acts on an incident directly from the dashboard.

---

## 5. Existing Pattern Adherence

The WHS dashboard must follow all established AEGIRA frontend patterns:

| Pattern | Requirement | How WHS Dashboard Follows It |
|---------|-------------|------------------------------|
| File naming | `PascalCase` components, `camelCase` hooks | `WhsDashboard.tsx`, hook in existing `useDashboardStats.ts` |
| State management | TanStack Query for server data | Single `useWhsDashboardStats()` hook |
| API calls | `apiClient` + `ENDPOINTS` constants | `ENDPOINTS.DASHBOARD.WHS` |
| Query keys | `['dashboard', <role>]` tuple pattern | `['dashboard', 'whs']` |
| Loading states | `PageLoader` wrapper | `<PageLoader skeleton="dashboard">` |
| Styling | Tailwind CSS only, `cn()` | Grid layout with Tailwind classes |
| Types | Explicit interfaces, no `any` | `WhsDashboardStats`, `PendingIncidentRow`, `ActivityEvent` |
| Routing | Role-based switch in `Dashboard.tsx` | `case 'WHS': return <WhsDashboard />` (direct import) |
| Imports | Dashboard sub-pages imported directly | `import { WhsDashboard } from './WhsDashboard'` |
| Components | Reuse existing before creating new | Reuses `StatCard`, `SeverityBadge`, `CaseStatusBadge`, `EmptyState` |
| Cache invalidation | Mutations invalidate `['dashboard']` prefix | `useApproveIncident`, `useRejectIncident`, `useUpdateCase` |
| Multi-tenant | Handled by `BaseRepository` | Backend filters by `company_id` automatically |
| No chart library | Not needed | Uses `StatCard`, `Table`, `Badge`, text feed |

---

**Prev:** [WHS Dashboard Implementation](WHS_DASHBOARD_IMPLEMENTATION.md)
**Next:** [Skill Requirements](SKILL_REQUIREMENTS.md)
