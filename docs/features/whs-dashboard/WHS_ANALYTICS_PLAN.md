# WHS Analytics Page — Implementation Plan

> **Route:** `/whs-analytics` | **Access:** WHS + ADMIN | **Backend:** `GET /api/v1/dashboard/whs-analytics?period=30d`

---

## What This Page Does

Separate from the operational WHS Dashboard. This page shows **historical trends and distributions** with a period selector (7d/30d/90d). Stale time: `STALE_TIMES.STATIC` (10 min).

---

## Layout

```
PageHeader: "WHS Analytics" + [7d] [30d*] [90d] period buttons

Row 1: 4x StatCard
  [Total Incidents] [Cases Created] [Avg Response Time] [Avg Resolution Time]

Row 2: Full-width LineChart — "Incident Trends" (total/approved/rejected lines)

Row 3: 2-col grid
  Left:  Horizontal BarChart — "Incidents by Type"
  Right: Horizontal BarChart — "Severity Distribution" (color-coded)

Row 4: 2-col grid
  Left:  Stacked BarChart — "Incidents by Team" (stacked by severity)
  Right: Donut PieChart — "Rejection Analysis"
```

---

## Response Interface

```typescript
// src/types/whs-analytics.types.ts
export type AnalyticsPeriod = '7d' | '30d' | '90d';

export interface WhsAnalyticsResponse {
  period: AnalyticsPeriod;
  dateRange: { start: string; end: string };
  summary: {
    totalIncidents: number;
    totalCasesCreated: number;
    avgResponseTimeHours: number | null;
    avgResolutionTimeHours: number | null;
    approvalRate: number;   // 0-100
    rejectionRate: number;  // 0-100
  };
  incidentTrends: { date: string; total: number; approved: number; rejected: number; pending: number }[];
  incidentsByType: { type: IncidentType; label: string; count: number; percentage: number }[];
  incidentsBySeverity: { severity: IncidentSeverity; count: number; percentage: number }[];
  incidentsByTeam: { teamId: string; teamName: string; count: number; severityBreakdown: { low: number; medium: number; high: number; critical: number } }[];
  rejectionsByReason: { reason: RejectionReason; label: string; count: number; percentage: number }[];
}
```

---

## Backend: 8 Parallel Queries

Service: `whs-analytics.service.ts` (follows `WhsDashboardService` pattern — constructor with `companyId` + `timezone`, single method, `Promise.all()`)

### Query Plan

| # | Query | Prisma Method | Index Used | Feeds |
|---|-------|--------------|-----------|-------|
| 1 | Incidents by status | `incident.groupBy(['status'])` | `@@index([company_id, status])` | summary.totalIncidents (sum all), approvalRate, rejectionRate |
| 2 | All incidents (lightweight) | `incident.findMany()` | `@@index([company_id, created_at])` | incidentTrends + incidentsByTeam (one fetch, two groupings) |
| 3 | Incidents by type | `incident.groupBy(['incident_type'])` | `@@index([company_id, created_at])` | incidentsByType |
| 4 | Incidents by severity | `incident.groupBy(['severity'])` | `@@index([company_id, created_at])` | incidentsBySeverity |
| 5 | Rejected by reason | `incident.groupBy(['rejection_reason'])` | `@@index([company_id, status])` filters REJECTED first | rejectionsByReason |
| 6 | Reviewed incidents | `incident.findMany()` | `@@index([company_id, created_at])` | avgResponseTimeHours |
| 7 | Cases created count | `case.count()` | `@@index([company_id, created_at])` | summary.totalCasesCreated |
| 8 | Resolved cases | `case.findMany()` | `@@index([company_id, created_at])` | avgResolutionTimeHours |

All filtered by `company_id` + `created_at >= periodStart` + `created_at < periodEnd`.

### Query Details

**Query 1 — Incidents by status** (replaces old queries 1+2)
```typescript
prisma.incident.groupBy({
  by: ['status'],
  where: { company_id, created_at: { gte: startDate, lt: endDate } },
  _count: { id: true },
})
// totalIncidents = sum all _count.id
// approvalRate = (APPROVED / total) * 100
// rejectionRate = (REJECTED / total) * 100
```

**Query 2 — All incidents lightweight** (replaces old queries 3+6, one fetch → two in-memory groupings)
```typescript
prisma.incident.findMany({
  where: { company_id, created_at: { gte: startDate, lt: endDate } },
  select: {
    created_at: true,
    status: true,
    severity: true,
    reporter: {
      select: { team: { select: { id: true, name: true } } },
    },
  },
  orderBy: { created_at: 'asc' },
})
// In-memory grouping 1: by date (Luxon toISODate) → incidentTrends
// In-memory grouping 2: by reporter.team.id → incidentsByTeam (with severity breakdown)
```
Why merged: both need all incidents in the period. One query fetching `created_at + status + severity + reporter.team` serves both trend and team charts. Avoids fetching the same rows twice.

**Query 3 — Incidents by type**
```typescript
prisma.incident.groupBy({
  by: ['incident_type'],
  where: { company_id, created_at: { gte: startDate, lt: endDate } },
  _count: { id: true },
})
```

**Query 4 — Incidents by severity**
```typescript
prisma.incident.groupBy({
  by: ['severity'],
  where: { company_id, created_at: { gte: startDate, lt: endDate } },
  _count: { id: true },
})
```

**Query 5 — Rejected by reason**
```typescript
prisma.incident.groupBy({
  by: ['rejection_reason'],
  where: {
    company_id,
    created_at: { gte: startDate, lt: endDate },
    status: 'REJECTED',
    rejection_reason: { not: null },
  },
  _count: { id: true },
})
```

**Query 6 — Reviewed incidents** (for avg response time)
```typescript
prisma.incident.findMany({
  where: {
    company_id,
    created_at: { gte: startDate, lt: endDate },
    reviewed_at: { not: null },
  },
  select: { created_at: true, reviewed_at: true },
})
// avgResponseTimeHours = avg(reviewed_at - created_at) in milliseconds → hours
```

**Query 7 — Cases created count**
```typescript
prisma.case.count({
  where: { company_id, created_at: { gte: startDate, lt: endDate } },
})
```

**Query 8 — Resolved cases** (for avg resolution time)
```typescript
prisma.case.findMany({
  where: {
    company_id,
    created_at: { gte: startDate, lt: endDate },
    resolved_at: { not: null },
  },
  select: { created_at: true, resolved_at: true },
})
// avgResolutionTimeHours = avg(resolved_at - created_at) in milliseconds → hours
```

### In-Memory Processing (from Query 2 results)

**Trend line grouping** — same pattern as `getTrends()` in `dashboard.service.ts:606`:
```typescript
// Group by date using Luxon timezone-aware formatting
const dateKey = DateTime.fromJSDate(row.created_at).setZone(timezone).toISODate();
// Bucket into { date, total, approved, rejected, pending }
```

**Team heatmap grouping**:
```typescript
// Group by reporter.team.id (null team → "Unassigned")
// Count severity breakdown per team: { low, medium, high, critical }
// Sort by total count descending
```

### Performance Notes

- 8 queries in parallel via `Promise.all()` (existing `WhsDashboardService` does 7)
- Max dataset: 90 days of incidents per company — safe for in-memory grouping
- All queries hit existing indexes: `[company_id, created_at]`, `[company_id, status]`
- Query 2 is the heaviest (row-level fetch with join) but bounded by period filter and minimal select

---

## Chart Library: Recharts

```bash
npm install recharts
```

Lightweight (~45KB), React-native composable components, no design system conflict with shadcn/ui. Dark mode via CSS variables (`hsl(var(--foreground))` etc).

---

## Color Config (`chartConfig.ts`)

```typescript
export const SEVERITY_COLORS = { LOW: '#3b82f6', MEDIUM: '#eab308', HIGH: '#f97316', CRITICAL: '#ef4444' };
export const STATUS_COLORS = { total: '#6366f1', approved: '#22c55e', rejected: '#ef4444', pending: '#eab308' };
export const INCIDENT_TYPE_COLORS = { PHYSICAL_INJURY: '#ef4444', ILLNESS_SICKNESS: '#f97316', MENTAL_HEALTH: '#8b5cf6', MEDICAL_EMERGENCY: '#dc2626', HEALTH_SAFETY_CONCERN: '#eab308', OTHER: '#6b7280' };
export const REJECTION_COLORS = ['#ef4444', '#f97316', '#eab308', '#6b7280'];
```

---

## Hook Pattern

```typescript
// src/features/dashboard/hooks/useWhsAnalytics.ts
export function useWhsAnalytics(period: AnalyticsPeriod = '30d') {
  return useQuery({
    queryKey: ['dashboard', 'whs-analytics', period],
    staleTime: STALE_TIMES.STATIC,
    placeholderData: keepPreviousData,
    queryFn: () => apiClient.get<WhsAnalyticsResponse>(`${ENDPOINTS.DASHBOARD.WHS_ANALYTICS}?period=${period}`),
  });
}
```

---

## Utility

```typescript
// Add to src/lib/utils/format.utils.ts
export function formatDuration(hours: number | null): string {
  if (hours === null) return 'N/A';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} hrs`;
  return `${(hours / 24).toFixed(1)} days`;
}
```

---

## Files to Create (10)

| File | What |
|------|------|
| `aegira-backend/src/modules/dashboard/whs-analytics.service.ts` | Backend service (8 parallel queries) |
| `aegira-frontend/src/types/whs-analytics.types.ts` | Types |
| `aegira-frontend/src/features/dashboard/hooks/useWhsAnalytics.ts` | Query hook |
| `aegira-frontend/src/features/dashboard/pages/WhsAnalyticsPage.tsx` | Page |
| `aegira-frontend/src/features/dashboard/components/whs-analytics/chartConfig.ts` | Colors |
| `aegira-frontend/src/features/dashboard/components/whs-analytics/IncidentTrendChart.tsx` | LineChart |
| `aegira-frontend/src/features/dashboard/components/whs-analytics/IncidentTypeChart.tsx` | BarChart horizontal |
| `aegira-frontend/src/features/dashboard/components/whs-analytics/SeverityDistributionChart.tsx` | BarChart horizontal |
| `aegira-frontend/src/features/dashboard/components/whs-analytics/TeamIncidentChart.tsx` | Stacked BarChart |
| `aegira-frontend/src/features/dashboard/components/whs-analytics/RejectionAnalysisChart.tsx` | Donut PieChart |

## Files to Modify (8)

| File | Change |
|------|--------|
| `aegira-frontend/package.json` | Add `recharts` |
| `aegira-frontend/src/lib/api/endpoints.ts` | Add `WHS_ANALYTICS: '/dashboard/whs-analytics'` |
| `aegira-frontend/src/config/routes.config.ts` | Add `WHS_ANALYTICS: '/whs-analytics'` |
| `aegira-frontend/src/routes/index.tsx` | Lazy import + Route under WHS+ADMIN guard |
| `aegira-frontend/src/components/layout/Sidebar.tsx` | Add "Analytics" nav (TrendingUp icon) for WHS + ADMIN |
| `aegira-backend/src/modules/dashboard/dashboard.routes.ts` | Add `GET /whs-analytics` route with `whsAccess` |
| `aegira-backend/src/modules/dashboard/dashboard.controller.ts` | Add `getWhsAnalytics` function |
| `aegira-frontend/src/lib/utils/format.utils.ts` | Add `formatDuration()` |

---

## Implementation Order

1. **Backend** → `whs-analytics.service.ts` → controller → route
2. **Frontend foundation** → install recharts → types → endpoint → hook → formatDuration
3. **Chart components** → chartConfig → 5 chart wrappers
4. **Page + routing** → WhsAnalyticsPage → routes.config → index.tsx → Sidebar

---

## Key Patterns to Follow

- **Backend service class**: Same as `WhsDashboardService` — constructor `(companyId, timezone)`, single method, `Promise.all()` for parallel queries, Luxon for timezone-aware dates
- **In-memory date grouping**: Same as `getTrends()` in `dashboard.service.ts:606` — fetch rows, format date with Luxon, reduce into buckets
- **Frontend page**: `PageLoader` wrapper → `PageHeader` with action buttons → StatCard grid → Card sections
- **Chart components**: Each in its own file, accepts typed data prop, wraps in Card, handles empty state with `EmptyState` component
- **Hook**: `queryKey` includes period, uses `STALE_TIMES.STATIC`, `placeholderData: keepPreviousData`
- **Routing**: Lazy import in `routes/index.tsx`, `RouteGuard allowedRoles={['ADMIN', 'WHS']}`, `ROUTES` constant
- **Sidebar**: Add nav item with `TrendingUp` icon after "Cases" for both WHS and ADMIN roles
