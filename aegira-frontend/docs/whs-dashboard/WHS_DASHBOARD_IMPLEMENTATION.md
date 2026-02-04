# WHS Dashboard Implementation Plan

## Document Information

| Field | Value |
|-------|-------|
| **Project** | AEGIRA V5 — Workforce Readiness & WHS Management |
| **Document** | Phased build plan for WHS incident monitoring dashboard |
| **Version** | 3.0 |
| **Date** | 2026-02-04 |
| **Audience** | Developers, Tech Leads |
| **Prereq** | [WHS Feature Audit](WHS_FEATURE_AUDIT.md), [WHS Dashboard Design](WHS_DASHBOARD_DESIGN.md) |

---

## Table of Contents

1. [Phase Overview](#1-phase-overview)
2. [Phase 1: Backend Endpoint](#2-phase-1-backend-endpoint)
3. [Phase 2: Frontend Data Layer](#3-phase-2-frontend-data-layer)
4. [Phase 3: Frontend Components](#4-phase-3-frontend-components)
5. [Phase 4: Page Assembly & Routing](#5-phase-4-page-assembly--routing)
6. [Phase 5: Polish & Testing](#6-phase-5-polish--testing)
7. [Dependency Graph](#7-dependency-graph)
8. [File Checklist](#8-file-checklist)

---

## 1. Phase Overview

| Phase | Objective | Depends On |
|-------|-----------|-----------|
| **Phase 1** | Single backend endpoint: `GET /dashboard/whs` | — |
| **Phase 2** | Types, endpoint constant, query hook | Phase 1 |
| **Phase 3** | 3 section components (table, cases, activity) | Phase 2 |
| **Phase 4** | Page composition, Dashboard router fix | Phase 3 |
| **Phase 5** | Empty states, loading skeleton, cache invalidation, tests | Phase 4 |

---

## 2. Phase 1: Backend Endpoint

**Objective:** Create `GET /api/v1/dashboard/whs` that returns all data the WHS dashboard needs in a single response.

### Task 1.1: WHS Dashboard Service

- **New file:** `aegira-backend/src/modules/dashboard/whs-dashboard.service.ts`
- **Work:**

**Summary counts:**
```sql
-- Pending incidents
SELECT COUNT(*) FROM incident WHERE company_id = ? AND status = 'PENDING'

-- My open cases (assigned to current user)
SELECT COUNT(*) FROM "case"
WHERE company_id = ? AND assigned_to = :personId AND status IN ('OPEN', 'INVESTIGATING')

-- Total open cases
SELECT COUNT(*) FROM "case"
WHERE company_id = ? AND status IN ('OPEN', 'INVESTIGATING')

-- Resolved this month
SELECT COUNT(*) FROM "case"
WHERE company_id = ? AND resolved_at >= :startOfMonth AND resolved_at < :startOfNextMonth
```

**Cases by status:**
```sql
SELECT status, COUNT(*) FROM "case" WHERE company_id = ? GROUP BY status
```

**Pending incidents (top 5):**
```sql
SELECT i.id, i.incident_number, i.title, i.incident_type, i.severity, i.created_at,
       p.first_name || ' ' || p.last_name AS reporter_name
FROM incident i
JOIN person p ON i.reporter_id = p.id
WHERE i.company_id = ? AND i.status = 'PENDING'
ORDER BY
  CASE i.severity WHEN 'CRITICAL' THEN 4 WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END DESC,
  i.created_at ASC
LIMIT 5
```

**Recent activity (last 10 events):**
```sql
SELECT e.id, e.event_type, e.payload, e.created_at, p.first_name, p.last_name
FROM event e
LEFT JOIN person p ON e.person_id = p.id
WHERE e.company_id = ?
  AND e.event_type IN (
    'INCIDENT_CREATED', 'INCIDENT_APPROVED', 'INCIDENT_REJECTED',
    'CASE_CREATED', 'CASE_UPDATED', 'CASE_RESOLVED'
  )
ORDER BY e.created_at DESC
LIMIT 10
```

- Format activity events into human-readable messages server-side
- Use Luxon for timezone-aware "start of month" calculation

### Task 1.2: Route + Controller

- **Update:** `aegira-backend/src/modules/dashboard/routes.ts`
  - Add: `GET /whs` with `roleMiddleware(['WHS', 'ADMIN'])`
- **Update:** `aegira-backend/src/modules/dashboard/controller.ts`
  - Add handler that calls service, returns `{ success: true, data: WhsDashboardStats }`

---

## 3. Phase 2: Frontend Data Layer

### Task 2.1: Types

- **New file:** `aegira-frontend/src/types/whs-dashboard.types.ts`
- **Work:** Create `WhsDashboardStats`, `PendingIncidentRow`, `ActivityEvent` interfaces
- **Spec:** See [WHS Dashboard Design — Section 5](WHS_DASHBOARD_DESIGN.md#5-typescript-interfaces)

### Task 2.2: Endpoint Constant

- **Update:** `aegira-frontend/src/lib/api/endpoints.ts`
- **Work:** Add `WHS` to the existing `DASHBOARD` object (follows existing pattern: `DASHBOARD.WORKER`, `DASHBOARD.TEAM_LEAD`, etc.):
  ```typescript
  DASHBOARD: {
    WORKER: '/dashboard/worker',
    TEAM_LEAD: '/dashboard/team-lead',
    SUPERVISOR: '/dashboard/supervisor',
    ADMIN: '/dashboard/admin',
    WHS: '/dashboard/whs',           // ← add this
  },
  ```

### Task 2.3: Query Hook

- **Add to existing file:** `aegira-frontend/src/features/dashboard/hooks/useDashboardStats.ts`
- **Why:** All dashboard hooks live in this one file — follows existing grouping pattern.
- **Work:**
  ```typescript
  import type { WhsDashboardStats } from '@/types/whs-dashboard.types';

  // Re-export for convenience
  export type { WhsDashboardStats };

  export function useWhsDashboardStats() {
    return useQuery({
      queryKey: ['dashboard', 'whs'],
      staleTime: STALE_TIMES.STANDARD,
      queryFn: () => apiClient.get<WhsDashboardStats>(ENDPOINTS.DASHBOARD.WHS),
    });
  }
  ```

**Pattern notes (matching existing hooks exactly):**
- queryKey: `['dashboard', 'whs']` — follows `['dashboard', <role>]` tuple pattern
- staleTime: `STALE_TIMES.STANDARD` — same as Worker/TeamLead/Supervisor
- No `refetchOnWindowFocus` — only TeamLead has it (for real-time member status); WHS data is less volatile
- Lives in `useDashboardStats.ts` alongside the other 4 dashboard hooks

---

## 4. Phase 3: Frontend Components

All three components can be built in parallel.

### Task 3.1: PendingIncidentsTable

- **New file:** `aegira-frontend/src/features/dashboard/components/whs/PendingIncidentsTable.tsx`
- **Props:**
  ```typescript
  interface PendingIncidentsTableProps {
    incidents: PendingIncidentRow[];
  }
  ```
- **Behavior:**
  - Simple `<Table>` (not DataTable — no server pagination, max 5 rows)
  - Columns: Incident #, Title, Reporter, Type, Severity (`SeverityBadge`), Submitted (relative time), Actions
  - Actions: View (link), Approve (`useApproveIncident`), Reject (`RejectionDialog` + `useRejectIncident`)
  - If empty: `<EmptyState icon={CheckCircle} title="No pending incidents" description="All incidents have been reviewed" />`
  - Footer: `<Link to={ROUTES.ADMIN_INCIDENTS}>View all pending incidents</Link>` (only when incidents.length > 0)
  - Use `ROUTES` constant — never hardcode paths

### Task 3.2: CasesByStatus

- **New file:** `aegira-frontend/src/features/dashboard/components/whs/CasesByStatus.tsx`
- **Props:**
  ```typescript
  interface CasesByStatusProps {
    casesByStatus: {
      open: number;
      investigating: number;
      resolved: number;
      closed: number;
    };
  }
  ```
- **Behavior:**
  - Four rows, each with `CaseStatusBadge` + count number
  - Each row clickable → navigates to cases page filtered by status
  - Wrap in `<Card>` with `<CardHeader><CardTitle>Cases Overview</CardTitle></CardHeader>`

### Task 3.3: RecentActivity

- **New file:** `aegira-frontend/src/features/dashboard/components/whs/RecentActivity.tsx`
- **Props:**
  ```typescript
  interface RecentActivityProps {
    events: ActivityEvent[];
  }
  ```
- **Behavior:**
  - Scrollable list (`max-h-[400px] overflow-y-auto`)
  - Each event: severity dot + message + relative timestamp
  - Clickable rows if `actionUrl` is present
  - If empty: "No recent activity" text
  - Wrap in `<Card>` with `<CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>`

---

## 5. Phase 4: Page Assembly & Routing

### Task 4.1: WhsDashboard Page

- **New file:** `aegira-frontend/src/features/dashboard/pages/WhsDashboard.tsx`
- **Work:**
  - Import `useWhsDashboardStats` from `../hooks/useDashboardStats`
  - Import `StatCard` from `../components/StatCard`
  - Import `PendingIncidentsTable`, `CasesByStatus`, `RecentActivity` from `../components/whs/`
  - Wrap in `<PageLoader isLoading={isLoading} error={error} skeleton="dashboard">`
  - Four `StatCard` components with correct prop patterns:
    ```typescript
    <StatCard
      title="Pending Incidents"
      value={data?.pendingIncidentsCount || 0}
      icon={<AlertTriangle className="h-4 w-4" />}
      description="Awaiting your review"
      iconBgColor="orange"
    />
    <StatCard
      title="My Open Cases"
      value={data?.myCasesCount || 0}
      icon={<FolderOpen className="h-4 w-4" />}
      description="Assigned to you"
      iconBgColor="blue"
    />
    <StatCard
      title="Total Open Cases"
      value={data?.totalOpenCasesCount || 0}
      icon={<Briefcase className="h-4 w-4" />}
      description="Across all officers"
      iconBgColor="purple"
    />
    <StatCard
      title="Resolved This Month"
      value={data?.resolvedThisMonthCount || 0}
      icon={<CheckCircle className="h-4 w-4" />}
      description="This month"
      iconBgColor="green"
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

### Task 4.2: Fix Dashboard Router

- **Update:** `aegira-frontend/src/features/dashboard/pages/Dashboard.tsx`
- **Work:** Add WHS case to the existing switch statement. Import directly (not lazy-loaded — matches existing pattern):
  ```typescript
  import { WhsDashboard } from './WhsDashboard';

  // Inside switch:
  case 'WHS':
    return <WhsDashboard />;
  ```
- This is the **critical fix** — WHS officers currently fall through to `default:` which renders WorkerDashboard
- **Pattern note:** All dashboard sub-pages are imported directly in Dashboard.tsx (NOT lazy-loaded). The lazy loading happens at the route level in `routes/index.tsx` where `Dashboard` itself is lazy.

### Task 4.3: Route Config — NOT NEEDED

No separate route needed. The existing `/dashboard` route already renders `Dashboard.tsx` which handles role routing. Adding a `WHS_DASHBOARD` route constant is unnecessary.

---

## 6. Phase 5: Polish & Testing

### Task 5.1: Empty States

- Zero pending incidents → `EmptyState` with "No pending incidents" + "All incidents have been reviewed"
- Zero cases → "No cases yet"
- Zero activity → "No recent activity"
- New company with no incidents → all sections show empty states gracefully

### Task 5.2: Loading Skeleton

- Use `skeleton="dashboard"` in `PageLoader` — matches AdminDashboard and WorkerDashboard

### Task 5.3: Cache Invalidation

Update existing mutation hooks to also invalidate the WHS dashboard:
- **`useApproveIncident`** — add: `queryClient.invalidateQueries({ queryKey: ['dashboard'] });`
- **`useRejectIncident`** — add: `queryClient.invalidateQueries({ queryKey: ['dashboard'] });`
- **`useUpdateCase`** — add: `queryClient.invalidateQueries({ queryKey: ['dashboard'] });`

**Why `['dashboard']` and not `['dashboard', 'whs']`?** Using the prefix `['dashboard']` invalidates all dashboard queries. This is the established pattern — see `useDeleteTeam` and `useSubmitCheckIn` which both invalidate `['dashboard']` broadly. This ensures the WHS dashboard refreshes regardless of the exact query key suffix.

### Task 5.4: Tests

- **Hook test:** `useWhsDashboardStats` returns correct data shape (MSW mock for `GET /dashboard/whs`)
- **Component tests:**
  - `PendingIncidentsTable` renders rows with `SeverityBadge`
  - `PendingIncidentsTable` shows `EmptyState` when incidents array is empty
  - `CasesByStatus` renders all 4 status counts with `CaseStatusBadge`
  - `RecentActivity` shows events with relative timestamps
- **Integration:** `WhsDashboard` renders all sections with mock data

---

## 7. Dependency Graph

```
Phase 1 (Backend)
  ├── Task 1.1  WHS dashboard service
  └── Task 1.2  Route + controller
         │
         ▼
Phase 2 (Frontend Data Layer)
  ├── Task 2.1  Types (new file)
  ├── Task 2.2  Endpoint constant (update DASHBOARD object)
  └── Task 2.3  Query hook (add to existing useDashboardStats.ts)
         │
         ▼
Phase 3 (Components) ─── all parallel
  ├── Task 3.1  PendingIncidentsTable
  ├── Task 3.2  CasesByStatus
  └── Task 3.3  RecentActivity
         │
         ▼
Phase 4 (Assembly)
  ├── Task 4.1  WhsDashboard page
  └── Task 4.2  Fix Dashboard router (CRITICAL)
         │
         ▼
Phase 5 (Polish) ─── all parallel
  ├── Task 5.1  Empty states
  ├── Task 5.2  Loading skeleton
  ├── Task 5.3  Cache invalidation (update 3 mutation hooks)
  └── Task 5.4  Tests
```

---

## 8. File Checklist

### 8.1 New Backend Files

- [ ] `aegira-backend/src/modules/dashboard/whs-dashboard.service.ts`

### 8.2 Updated Backend Files

- [ ] `aegira-backend/src/modules/dashboard/routes.ts` — add `GET /whs`
- [ ] `aegira-backend/src/modules/dashboard/controller.ts` — add WHS handler

### 8.3 New Frontend Files

- [ ] `aegira-frontend/src/types/whs-dashboard.types.ts`
- [ ] `aegira-frontend/src/features/dashboard/pages/WhsDashboard.tsx`
- [ ] `aegira-frontend/src/features/dashboard/components/whs/PendingIncidentsTable.tsx`
- [ ] `aegira-frontend/src/features/dashboard/components/whs/CasesByStatus.tsx`
- [ ] `aegira-frontend/src/features/dashboard/components/whs/RecentActivity.tsx`

### 8.4 Updated Frontend Files

- [ ] `aegira-frontend/src/lib/api/endpoints.ts` — add `WHS` to `DASHBOARD` object
- [ ] `aegira-frontend/src/features/dashboard/hooks/useDashboardStats.ts` — add `useWhsDashboardStats`
- [ ] `aegira-frontend/src/features/dashboard/pages/Dashboard.tsx` — add `case 'WHS'` + import
- [ ] `aegira-frontend/src/features/incident/hooks/useApproveIncident.ts` — invalidate `['dashboard']`
- [ ] `aegira-frontend/src/features/incident/hooks/useRejectIncident.ts` — invalidate `['dashboard']`
- [ ] `aegira-frontend/src/features/incident/hooks/useUpdateCase.ts` — invalidate `['dashboard']`

### 8.5 No New Dependencies

No chart library or new npm packages needed.

---

**Prev:** [WHS Dashboard Design](WHS_DASHBOARD_DESIGN.md)
**Next:** [Dashboard Patterns](DASHBOARD_PATTERNS.md)
