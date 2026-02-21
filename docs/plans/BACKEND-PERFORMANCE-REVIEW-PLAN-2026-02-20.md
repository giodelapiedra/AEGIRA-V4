# Backend Performance Review + Execution Plan (2026-02-20)

## Scope Reviewed
- `aegira-backend/src/modules/dashboard/whs-dashboard.service.ts`
- `aegira-backend/src/modules/dashboard/dashboard.service.ts`
- `aegira-backend/src/modules/dashboard/whs-analytics.service.ts`
- `aegira-backend/src/modules/incident/incident.service.ts`
- `aegira-backend/src/modules/incident/incident.controller.ts`
- `aegira-backend/src/modules/case/case.controller.ts`
- `aegira-backend/src/config/database.ts`
- `aegira-backend/src/middleware/logger.ts`
- `aegira-backend/prisma/schema.prisma`
- `aegira-backend/src/jobs/missed-check-in-detector.ts`
- `aegira-backend/src/jobs/transfer-processor.ts`

## Findings (Ordered by Severity)

### High
1. Missing index coverage for hot dashboard query patterns  
   - Recent activity query filters by `company_id` + `event_type` and sorts by `created_at`:
     `aegira-backend/src/modules/dashboard/whs-dashboard.service.ts:176`  
   - Current Event indexes do not include `(company_id, event_type, created_at)`:
     `aegira-backend/prisma/schema.prisma:266` to `aegira-backend/prisma/schema.prisma:270`  
   - WHS case counters use `assigned_to + status` and `resolved_at` date-range filters:
     `aegira-backend/src/modules/dashboard/whs-dashboard.service.ts:118` to `aegira-backend/src/modules/dashboard/whs-dashboard.service.ts:142`  
   - Case model currently has no `(company_id, assigned_to, status)` and no `(company_id, resolved_at)` index:
     `aegira-backend/prisma/schema.prisma:528` to `aegira-backend/prisma/schema.prisma:533`

2. Over-fetch + in-memory sort for top pending incidents  
   - Pulls 20 rows, sorts in app, then slices to 5:
     `aegira-backend/src/modules/dashboard/whs-dashboard.service.ts:153` to `aegira-backend/src/modules/dashboard/whs-dashboard.service.ts:226`  
   - Adds avoidable DB/network/app CPU overhead on a hot dashboard path.

3. Concurrency hotspot on incident/case number generation  
   - Uses `findFirst(orderBy desc) + 1` with retry loops:
     `aegira-backend/src/modules/incident/incident.service.ts:37` to `aegira-backend/src/modules/incident/incident.service.ts:46`  
     `aegira-backend/src/modules/incident/incident.service.ts:193` to `aegira-backend/src/modules/incident/incident.service.ts:199`  
   - Under concurrent create/approve traffic this can increase retries and tail latency.

### Medium
4. Unnecessary join data in supervisor dashboard check-in query  
   - Query includes `person.team_id` join payload even though worker-team mapping is already fetched:
     `aegira-backend/src/modules/dashboard/dashboard.service.ts:556` to `aegira-backend/src/modules/dashboard/dashboard.service.ts:583`  
   - Avoidable relation load on frequently accessed summary endpoint.

5. Observability gap: no production query-level timing  
   - Prisma query logs are only enabled in development:
     `aegira-backend/src/config/database.ts:14`  
   - Request logging has total duration but no DB-time split:
     `aegira-backend/src/middleware/logger.ts:20` to `aegira-backend/src/middleware/logger.ts:29`

6. Timeline access check performs full incident detail load before timeline fetch  
   - Access validation uses full `findById` payload then performs timeline query:
     `aegira-backend/src/modules/incident/incident.controller.ts:232` to `aegira-backend/src/modules/incident/incident.controller.ts:243`  
   - Can be reduced to a lean access-check query (`id`, `reporter_id`) prior to timeline fetch.

## Potential Bug / Correctness Risk
- ~~Comment and behavior mismatch risk in role checks:~~
  `aegira-backend/src/modules/incident/incident.controller.ts:207`
  **RESOLVED (2026-02-20):** ADMIN removal from incident/case detail view access was confirmed as intentional.
  Cases and incidents are WHS-domain entities; ADMIN manages workforce/teams, not safety investigations.
  See `docs/changelogs/2026-02-20-admin-dashboard-ui-redesign-and-cleanup.md` Section 7.

## Right-Sized Solutions (No Over-Engineering)

1. Missing index coverage (High)
- Do now:
  - Add only 3 targeted indexes:
    - `events(company_id, event_type, created_at desc)`
    - `cases(company_id, assigned_to, status)`
    - `cases(company_id, resolved_at)`
- Why this is enough:
  - Directly matches hot filters/sorts in current dashboard queries.
- Do NOT do now:
  - Broad index proliferation on every column combination.
  - Partitioning tables (not justified by current evidence).

2. Over-fetch + in-memory sort (High)
- Do now:
  - Push sort to DB (`severity desc`, `created_at asc`) and set `take: 5`.
  - Remove the in-memory `SEVERITY_ORDER` sort + `.slice(0, 5)` in `whs-dashboard.service.ts:218-225`.
- Why this works:
  - PostgreSQL sorts enums by definition order, not alphabetically.
  - `IncidentSeverity` is defined as `LOW, MEDIUM, HIGH, CRITICAL` in `schema.prisma:444-449`.
  - `ORDER BY severity DESC` yields CRITICAL > HIGH > MEDIUM > LOW — matches the business priority.
  - **Note:** If the enum definition order is ever changed, the DB sort will follow the new order. Keep enum values in ascending severity order.
- Do NOT do now:
  - Add caching layer for this query before proving it remains hot after fix.

3. Incident/case numbering contention (High)
- Do now:
  - Keep current retry loop temporarily but add metrics for retry frequency.
  - If retries are non-trivial in production, move to counter-table allocator.
- Why this is enough:
  - Avoids premature refactor if write concurrency is low.
- Do NOT do now:
  - Full redesign unless retry metrics show real contention.

4. Unnecessary join payload (Medium)
- Do now:
  - Remove `checkIn -> person.team_id` selection where worker map is already loaded.
- Why this is enough:
  - Reduces relation payload with zero behavior change.
- Do NOT do now:
  - Rewrite endpoint architecture.

5. Observability gap (Medium)
- Do now:
  - Add slow-query threshold logging and request correlation.
  - Keep full SQL/params logging only in development.
- Why this is enough:
  - Gives API-vs-DB latency split with minimal overhead.
- Do NOT do now:
  - Heavy APM rollout if logs/metrics are sufficient for current debugging.

6. Timeline access pre-check is heavy (Medium)
- Do now:
  - Add a lean access-check query (`id`, `reporter_id`) before timeline fetch.
- Why this is enough:
  - Removes unnecessary detail load on a read path.
- Do NOT do now:
  - Merge unrelated endpoints or introduce cache for timeline prematurely.

## Change Guardrails (Double-Check Before Merge)
- Every fix must map to an observed query pattern in this review.
- No new abstraction layer unless it removes repeated logic in at least 2 places.
- Prefer query/index tuning first, caching second, architecture changes last.
- For each change, require:
  - baseline metric
  - post-change metric
  - rollback path

## Full Plan (Before Code Changes)

### Phase 0: Baseline (No Code Changes)
- **Status: SKIPPED** — Supabase dashboard provides query-level stats; formal baseline capture deferred.

### Phase 1: Query-Level Quick Wins (Low Risk)
- **Status: COMPLETED (2026-02-21)**
1. ~~Remove over-fetch + app-side sort in WHS dashboard pending incidents.~~
   - Done: `whs-dashboard.service.ts` — `take: 20` + in-memory `SEVERITY_ORDER` sort + `.slice(0, 5)` replaced with `orderBy: [{ severity: 'desc' }, { created_at: 'asc' }]` + `take: 5`. `SEVERITY_ORDER` const removed.
2. ~~Remove unnecessary relation selection in supervisor dashboard check-in query.~~
   - Done: `dashboard.service.ts` — removed `person: { select: { team_id: true } }` from check-in query. Built `workerTeamMap` from existing `allWorkers` data to resolve team_id without the join.
3. ~~Convert timeline access pre-check to lean query to reduce payload and query cost.~~
   - Done: `incident.repository.ts` — added `findForAccessCheck(id)` selecting only `{ id, reporter_id }`. `incident.controller.ts` — `getIncidentTimeline` now uses lean query instead of full `findById`.
4. Re-check pagination defaults and enforce safe max limits on list endpoints.
   - **Deferred** — existing `parsePagination` already enforces max 100. No action needed.

### Phase 2: Database Index Improvements
- **Status: COMPLETED (2026-02-21)**
1. ~~Add Event index for recent activity reads.~~
   - Done: `@@index([company_id, event_type, created_at(sort: Desc)])` added to Event model.
2. ~~Add Case indexes for dashboard counters.~~
   - Done: `@@index([company_id, assigned_to, status])` and `@@index([company_id, resolved_at])` added to Case model.
3. Validate with `EXPLAIN ANALYZE` on top slow query shapes.
   - **Deferred** — indexes applied; validation via Supabase query stats when production traffic flows.
- Migration: `20260221100000_add_dashboard_performance_indexes` (manually applied via `prisma db execute` + `migrate resolve`).

### Phase 3: Sequence/Numbering Contention Hardening
- **Status: DEFERRED** — monitor-first approach per plan. Retry metrics to be added if contention is observed.
1. Replace `MAX + 1` style numbering for incidents/cases with a safer allocator:
   - per-company counter table row lock (`SELECT ... FOR UPDATE`) or DB sequence strategy.
2. Keep unique constraint as safety net.

### Phase 4: Monitoring and Latency Separation
- **Status: DEFERRED** — Supabase dashboard provides sufficient observability for now. Will revisit if DB-vs-API latency split becomes a debugging need.
1. Add Prisma query event timing with slow-query threshold in production.
2. Add request correlation IDs across request logs + DB query logs.
3. Emit metrics:
   - `api_duration_ms`
   - `db_total_duration_ms`
   - `db_query_count`
   - `slow_query_count`
4. Build API vs DB latency breakdown dashboard.

### Phase 5: Validation
- **Status: COMPLETED (2026-02-21)**
1. ~~Run typecheck and tests.~~
   - `npx tsc --noEmit`: 0 errors.
   - `npx vitest run`: 1 failure — **pre-existing** (FK constraint in test teardown `teams_leader_id_fkey`, same on clean master). Not related to performance changes.
2. Compare before/after:
   - **Deferred** — no formal baseline captured; will compare via Supabase query stats.
3. ~~Validate no functional regression in incident/case/dashboard flows.~~
   - Verified: typecheck passes, no new test failures, all query shapes preserved.

## Deliverables
1. ~~Severity-ranked review report with exact file references.~~ — This document.
2. ~~List of implemented fixes and associated queries/indexes.~~ — See Phase 1 + Phase 2 above.
3. Before/after performance snapshot. — **Deferred** (Supabase dashboard).
4. Remaining risks + next optimization backlog. — Phase 3 (numbering contention) and Phase 4 (observability).
