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

<!-- @pattern: frontend/page-patterns -->

## StatCard Component Reference

<!-- @pattern: ui/component-usage -->

## Team Context (Role-Based Filtering)

<!-- @pattern: backend/team-context -->

## Query Hook Pattern

<!-- @pattern: frontend/query-hooks -->

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
- ALWAYS use `STALE_TIMES.REALTIME` (30s) for operational dashboards
- ALWAYS use `PageLoader` with `skeleton="dashboard"`
- ALWAYS use `StatCard` from `features/dashboard/components/StatCard.tsx` — never recreate
- ALWAYS use `Promise.all` in backend services (parallel queries)
- ALWAYS filter by `company_id` (multi-tenant)
- Sub-component tables use `<Table>` (shadcn/ui), NOT `DataTable` (no pagination needed)
- Activity feed events should have `actionUrl` for clickable navigation
