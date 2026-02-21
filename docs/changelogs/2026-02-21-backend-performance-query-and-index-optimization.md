# 2026-02-21: Backend Performance - Query and Index Optimization

## Context

Based on `docs/plans/BACKEND-PERFORMANCE-REVIEW-PLAN-2026-02-20.md`, backend hot paths were optimized to reduce query overhead. This covers Phase 1 (query-level quick wins) and Phase 2 (database indexes), plus one intentional authorization scope update that happened in the same batch.

## Summary of Work

### 1) WHS Dashboard: remove over-fetch and in-memory sort

**File:** `aegira-backend/src/modules/dashboard/whs-dashboard.service.ts`

Before:
- Fetched 20 pending incidents (`take: 20`), then sorted in app and sliced to 5.

After:
- DB handles sorting: `orderBy: [{ severity: 'desc' }, { created_at: 'asc' }]`.
- Query now uses `take: 5`.
- In-memory severity map/sort/slice removed.

Impact:
- Fewer rows transferred (20 -> 5).
- Less app-side CPU and object churn.

---

### 2) Supervisor Dashboard: remove redundant relation payload

**File:** `aegira-backend/src/modules/dashboard/dashboard.service.ts`

Before:
- Check-in query selected `person.team_id` via relation join.
- Team mapping already existed in `allWorkers`.

After:
- Check-in query now selects only `person_id` and `readiness_score`.
- Team resolution uses `workerTeamMap` built from `allWorkers`.

Impact:
- Smaller query payload and less relation work on a frequent endpoint.

---

### 3) Incident timeline access-check: lean query

**Files:**
- `aegira-backend/src/modules/incident/incident.repository.ts`
- `aegira-backend/src/modules/incident/incident.controller.ts`

Before:
- Timeline access check used full `findById` relation payload.

After:
- Added `findForAccessCheck(id)` selecting only `{ id, reporter_id }`.
- `getIncidentTimeline` now uses the lean access-check query.

Impact:
- Removes unnecessary relation loads on timeline reads.

---

### 4) Authorization scope update (intentional): WHS-only detail access

**Files:**
- `aegira-backend/src/modules/incident/incident.controller.ts`
- `aegira-backend/src/modules/case/case.controller.ts`
- `aegira-backend/src/modules/case/case.routes.ts`

Change:
- Broad incident detail/timeline access is now `WHS`-only.
- Broad case detail access is now `WHS`-only.
- Related route comments updated.

Note:
- This is a policy change by design, not a performance optimization.

---

### 5) Database indexes for hot query patterns

**Files:**
- `aegira-backend/prisma/schema.prisma`
- `aegira-backend/prisma/migrations/20260221100000_add_dashboard_performance_indexes/migration.sql`

Added indexes:
- `events(company_id, event_type, created_at DESC)`
- `cases(company_id, assigned_to, status)`
- `cases(company_id, resolved_at)`

These match hot WHS dashboard filters/sorts.

---

## Validation

- `npx tsc --noEmit`: 0 errors
- `npx vitest run`: 1 failure (pre-existing FK teardown issue: `teams_leader_id_fkey`)
- No performance regression observed in touched query paths
- Behavior change included intentionally: access scope tightened to `WHS` for incident/case detail flows

## Scope

| Area | Status |
|---|---|
| WHS dashboard query optimization | Changed |
| Supervisor dashboard query optimization | Changed |
| Incident timeline access check | Changed |
| Access policy (incident/case detail scope) | Changed intentionally (`WHS`-only) |
| Database indexes (Event + Case) | Added |
| Frontend | Unchanged |
| Database schema (columns/models) | Unchanged |

## Deferred (Not in This Change)

- Phase 3: incident/case number contention hardening
- Phase 4: Prisma slow-query logging and request DB-time split
- Formal before/after latency comparison from production stats

## All Files in This Change (8)

1. `aegira-backend/src/modules/dashboard/whs-dashboard.service.ts`
2. `aegira-backend/src/modules/dashboard/dashboard.service.ts`
3. `aegira-backend/src/modules/incident/incident.repository.ts`
4. `aegira-backend/src/modules/incident/incident.controller.ts`
5. `aegira-backend/src/modules/case/case.controller.ts`
6. `aegira-backend/src/modules/case/case.routes.ts`
7. `aegira-backend/prisma/schema.prisma`
8. `aegira-backend/prisma/migrations/20260221100000_add_dashboard_performance_indexes/migration.sql`
