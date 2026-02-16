# Backend Performance Audit Report

**Date:** 2026-02-15
**Scope:** All backend API call patterns — services, controllers, repositories, cron jobs
**Verdict:** Codebase is generally well-optimized. Most dashboard and service code already uses `Promise.all()`, `select`, and batch queries. Found **1 P0**, **4 P1**, and **10 P2/P3** issues.

---

## Findings Summary

| # | Sev | Finding | File | Line |
|---|-----|---------|------|------|
| 1 | **P0** | `getTeamAnalytics` fetches ALL rows for JS aggregation | `team.service.ts` | 94–138 |
| 2 | P1 | `createTeam` — 4 sequential independent validation queries | `team.controller.ts` | 94–127 |
| 3 | P1 | `updateTeam` — 3 sequential validation queries after existence check | `team.controller.ts` | 178–214 |
| 4 | P1 | `updatePerson` — sequential team/leader validations | `person.controller.ts` | 228–299 |
| 5 | P1 | Supervisor dashboard — separate leaders query instead of `include` | `dashboard.service.ts` | 494–535 |
| 6 | P2 | `findById` over-fetches all team members on every call | `team.repository.ts` | 48–74 |
| 7 | P2 | O(days × workers) compliance loop in analytics | `team.service.ts` | 211–222 |
| 8 | P2 | Triple array scan for readiness distribution | `team.service.ts` | 260–262 |
| 9 | P2 | 3 sequential independent queries in `createImmediateMissedCheckIn` | `person.controller.ts` | 510–523 |
| 10 | P2 | Transfer processor — sequential `executeTransfer` in loop | `transfer-processor.ts` | 62–126 |
| 11 | P2 | Sequential event creates inside `approveIncident` transaction | `incident.service.ts` | 218–249 |
| 12 | P3 | Sequential company processing in missed-check-in cron | `missed-check-in-detector.ts` | 80–89 |
| 13 | P3 | Leader fetch outside `Promise.all` in notification helper | `person.controller.ts` | 43–56 |
| 14 | P3 | Sequential `emitEvent` in missed-check-in loop | `missed-check-in-detector.ts` | 349–366 |
| 15 | P3 | Pre-transaction fetch broader than needed in `approveIncident` | `incident.service.ts` | 157–159 |

---

## Detailed Findings

### Finding 1 (P0) — `getTeamAnalytics` fetches ALL check-in rows for JS aggregation

**File:** `src/modules/team/team.service.ts:94–138`

**Problem:** Fetches every individual check-in record for the entire period, then aggregates counts, averages, and distributions in JavaScript. For 100 workers over 90 days → **up to 9,000 rows** transferred when only ~90 aggregated rows are needed.

```typescript
// CURRENT — fetches all rows, aggregates in JS
const [checkIns, workers] = await Promise.all([
  this.prisma.checkIn.findMany({
    where: {
      company_id: this.companyId,
      check_in_date: { gte: startDate, lte: endDate },
      ...checkInTeamFilter,
    },
    select: {
      check_in_date: true, readiness_score: true, readiness_level: true, created_at: true,
      person: { select: { first_name: true, last_name: true } },
    },
  }),
  // ...workers query
]);

// Then loops over all 9K records to build dailyStats
for (const checkIn of checkIns) { dailyStats[dateKey].count++; ... }
// Then 3 more full scans:
const greenCount = checkIns.filter(c => c.readiness_level === 'GREEN').length;
const yellowCount = checkIns.filter(c => c.readiness_level === 'YELLOW').length;
const redCount = checkIns.filter(c => c.readiness_level === 'RED').length;
```

**Fix:** Split into a DB-level `groupBy` for trends and a limited query for records:

```typescript
const [dailyAggregates, records, workers] = await Promise.all([
  // 1. Aggregated trends — one row per day (~90 rows, not 9,000)
  this.prisma.checkIn.groupBy({
    by: ['check_in_date'],
    where: {
      company_id: this.companyId,
      check_in_date: { gte: startDate, lte: endDate },
      ...checkInTeamFilter,
    },
    _count: true,
    _avg: { readiness_score: true },
  }),
  // OR use $queryRaw for richer aggregation (green/yellow/red counts + avg submit time per day)

  // 2. Individual records — capped at 200 for the records table
  this.prisma.checkIn.findMany({
    where: { /* same */ },
    select: {
      check_in_date: true, readiness_score: true, readiness_level: true, created_at: true,
      person: { select: { first_name: true, last_name: true } },
    },
    orderBy: [{ check_in_date: 'desc' }, { created_at: 'desc' }],
    take: 200,
  }),

  // 3. Workers — unchanged
  this.prisma.person.findMany({ /* same */ }),
]);
```

**Impact:** ~100x reduction in data transfer for 90-day periods. Eliminates 3 redundant full-array scans.

---

### Finding 2 (P1) — `createTeam`: 4 sequential validation queries

**File:** `src/modules/team/team.controller.ts:94–127`

**Problem:** Four independent validation queries run one after another:

```typescript
const existing = await repository.findByName(data.name);                    // Query 1
const leader = await repository.findPersonById(data.leaderId);              // Query 2
const existingLeadTeam = await repository.findByLeaderId(data.leaderId);    // Query 3
const supervisor = await repository.findPersonById(data.supervisorId);      // Query 4
```

**Fix:**

```typescript
const [existing, leader, existingLeadTeam, supervisor] = await Promise.all([
  repository.findByName(data.name),
  repository.findPersonById(data.leaderId),
  repository.findByLeaderId(data.leaderId),
  data.supervisorId ? repository.findPersonById(data.supervisorId) : null,
]);
// Then validate each result as before
```

**Impact:** Saves 3 DB round-trips (~5–15ms each = 15–45ms saved per request).

---

### Finding 3 (P1) — `updateTeam`: 3 sequential validation queries after existence check

**File:** `src/modules/team/team.controller.ts:178–214`

**Problem:** Same pattern as `createTeam`. The `findById` must run first (existence check), but leader, leader-assignment, and supervisor validations are independent.

**Fix:**

```typescript
const existing = await repository.findById(id);
if (!existing) throw Errors.notFound('Team');

// These are independent — run in parallel
const [leader, existingLeadTeam, supervisor] = await Promise.all([
  data.leaderId !== undefined ? repository.findPersonById(data.leaderId) : null,
  data.leaderId !== undefined && leaderChanged ? repository.findByLeaderId(data.leaderId, id) : null,
  data.supervisorId !== undefined && data.supervisorId !== null
    ? repository.findPersonById(data.supervisorId) : null,
]);
```

---

### Finding 4 (P1) — `updatePerson`: sequential team/leader validations

**File:** `src/modules/person/person.controller.ts:228–299`

**Problem:** After the existence check, team validation (line 258), leader-team check (line 281), and deactivation guard (line 291) run sequentially.

**Fix:** After the existence check, determine which validations are needed and run them in parallel:

```typescript
const existing = await repository.findById(id);
if (!existing) throw Errors.notFound('Person');

// Determine what needs validation
const needsTeamCheck = data.teamId !== undefined && data.teamId !== null && data.teamId !== existing.team_id;
const needsLeaderCheck = data.role !== undefined && data.role !== 'TEAM_LEAD' && existing.role === 'TEAM_LEAD';
const needsDeactivationCheck = data.isActive === false && existing.is_active;

const teamRepository = new TeamRepository(prisma, companyId);
const [team, ledTeamForRole, ledTeamForDeactivation] = await Promise.all([
  needsTeamCheck ? teamRepository.findById(data.teamId!) : null,
  needsLeaderCheck ? teamRepository.findByLeaderId(id) : null,
  needsDeactivationCheck ? teamRepository.findByLeaderId(id) : null,
]);
// Then validate each result
```

**Note:** `ledTeamForRole` and `ledTeamForDeactivation` call the same method — can be deduplicated:

```typescript
const needsLedTeam = needsLeaderCheck || needsDeactivationCheck;
const [team, ledTeam] = await Promise.all([
  needsTeamCheck ? teamRepository.findById(data.teamId!) : null,
  needsLedTeam ? teamRepository.findByLeaderId(id) : null,
]);
```

---

### Finding 5 (P1) — Supervisor dashboard: separate leaders query

**File:** `src/modules/dashboard/dashboard.service.ts:494–535`

**Problem:** Teams are fetched first (line 494), then leader names are fetched in a separate query using extracted `leader_id`s (line 529).

```typescript
const teams = await prisma.team.findMany({
  select: { id: true, name: true, leader_id: true, /* NO leader include */ },
});
// Then separate query:
const leaders = await prisma.person.findMany({
  where: { id: { in: leaderIds } },
});
```

**Fix:** Include leader in the original teams query:

```typescript
const teams = await prisma.team.findMany({
  select: {
    id: true, name: true, leader_id: true, work_days: true, check_in_start: true, check_in_end: true,
    leader: { select: { id: true, first_name: true, last_name: true } },
  },
});
// Remove the separate leaders query from Promise.all
```

---

### Finding 6 (P2) — `findById` over-fetches all team members

**File:** `src/modules/team/team.repository.ts:48–74`

**Problem:** `findById` always loads all active team members with `include: { members: { ... } }`. Most callers only need team metadata (validations, updates, notifications).

**Fix:** Create a lightweight variant:

```typescript
// Slim — for validation, update guards, notifications
async findByIdSlim(id: string) {
  return this.prisma.team.findFirst({
    where: this.where({ id }),
    // No members include
  });
}

// Full — only for GET /teams/:id detail endpoint
async findByIdWithMembers(id: string) {
  return this.prisma.team.findFirst({
    where: this.where({ id }),
    include: {
      members: { where: { is_active: true }, select: { id: true, first_name: true, last_name: true, email: true, role: true } },
      supervisor: { select: { id: true, first_name: true, last_name: true } },
      _count: { select: { members: true } },
    },
  });
}
```

---

### Finding 7 (P2) — O(days × workers) compliance loop

**File:** `src/modules/team/team.service.ts:211–222`

**Problem:** For each day in the range, all workers are filtered to count expected workers. 90 days × 100 workers = 9,000 filter iterations.

**Fix:** Pre-group workers by day-of-week:

```typescript
const workersByDow = new Map<number, Array<{ eligibleFrom: string }>>();
for (const w of workerAssignedDates) {
  for (let dow = 0; dow < 7; dow++) {
    if (isWorkDay(dow, w, w.team)) {
      const arr = workersByDow.get(dow) ?? [];
      arr.push({ eligibleFrom: w.assignedDateStr! });
      workersByDow.set(dow, arr);
    }
  }
}
// In the loop: O(workers_per_dow) filtered once per day
for (const day of dateRange) {
  const eligible = workersByDow.get(day.dow) ?? [];
  const expectedWorkers = eligible.filter(w => w.eligibleFrom < day.dateStr).length;
}
```

---

### Finding 8 (P2) — Triple array scan for readiness distribution

**File:** `src/modules/team/team.service.ts:260–262`

**Problem:** Three separate `.filter()` calls over all check-ins:

```typescript
const greenCount = checkIns.filter(c => c.readiness_level === 'GREEN').length;
const yellowCount = checkIns.filter(c => c.readiness_level === 'YELLOW').length;
const redCount = checkIns.filter(c => c.readiness_level === 'RED').length;
```

**Fix:** Accumulate during the existing daily loop (lines 159–180):

```typescript
let totalGreen = 0, totalYellow = 0, totalRed = 0;
for (const checkIn of checkIns) {
  // ...existing dailyStats logic...
  if (checkIn.readiness_level === 'GREEN') totalGreen++;
  else if (checkIn.readiness_level === 'YELLOW') totalYellow++;
  else totalRed++;
}
```

---

### Finding 9 (P2) — `createImmediateMissedCheckIn`: 3 sequential independent queries

**File:** `src/modules/person/person.controller.ts:510–523`

**Problem:**

```typescript
const holidayToday = await isHoliday(prisma, companyId, todayStr);       // Query 1
const existingCheckIn = await prisma.checkIn.findFirst({ ... });         // Query 2
const existingMissed = await missedRepo.findExistingForDate(...);        // Query 3
```

**Fix:**

```typescript
const [holidayToday, existingCheckIn, existingMissed] = await Promise.all([
  isHoliday(prisma, companyId, todayStr),
  prisma.checkIn.findFirst({ where: { company_id: companyId, person_id: personId, check_in_date: todayDate }, select: { id: true } }),
  missedRepo.findExistingForDate(todayDate, [personId]),
]);
if (holidayToday || existingCheckIn || existingMissed.has(personId)) return;
```

**Tradeoff:** Loses short-circuit behavior. Acceptable here since this runs fire-and-forget.

---

### Finding 10 (P2) — Transfer processor: sequential updates in loop

**File:** `src/jobs/transfer-processor.ts:62–126`

**Problem:** Each transfer runs `executeTransfer()` sequentially. For companies with many simultaneous transfers, this creates N individual UPDATE queries.

**Note:** The loop includes error handling per-transfer and conditional logic (skip inactive teams), so simple batching isn't trivial. Consider processing valid transfers in a batch after filtering:

```typescript
const validTransfers = pendingTransfers.filter(t => t.effective_team_id && t.effective_team?.is_active);
const cancelledTransfers = pendingTransfers.filter(t => t.effective_team && !t.effective_team.is_active);

// Batch cancel
if (cancelledTransfers.length > 0) {
  await prisma.person.updateMany({
    where: { id: { in: cancelledTransfers.map(t => t.id) } },
    data: { effective_team_id: null, effective_transfer_date: null },
  });
}

// Batch execute
await prisma.$transaction(
  validTransfers.map(t =>
    prisma.person.update({
      where: { id: t.id },
      data: { team_id: t.effective_team_id, team_assigned_at: todayDate, effective_team_id: null, effective_transfer_date: null },
    })
  )
);
```

---

### Finding 11 (P2) — Sequential event creates inside `approveIncident` transaction

**File:** `src/modules/incident/incident.service.ts:218–249`

**Problem:**

```typescript
await tx.event.create({ data: buildEventData({ eventType: 'INCIDENT_APPROVED', ... }) });
await tx.event.create({ data: buildEventData({ eventType: 'CASE_CREATED', ... }) });
```

**Fix:**

```typescript
await Promise.all([
  tx.event.create({ data: buildEventData({ eventType: 'INCIDENT_APPROVED', ... }) }),
  tx.event.create({ data: buildEventData({ eventType: 'CASE_CREATED', ... }) }),
]);
```

---

### Finding 12 (P3) — Sequential company processing in cron job

**File:** `src/jobs/missed-check-in-detector.ts:80–89`

**Status:** Intentional for connection pool control. Consider `Promise.allSettled` with concurrency limiter (e.g., `p-limit(3)`) for multi-tenant deployments with many companies.

---

### Finding 13 (P3) — Leader fetch outside `Promise.all`

**File:** `src/modules/person/person.controller.ts:43–56`

**Problem:** The team and person are fetched in parallel (good), but the leader is fetched after:

```typescript
const [team, person] = await Promise.all([teamRepo.findById(teamId), personRepo.findById(personId)]);
// Then:
const leader = await personRepo.findById(team.leader_id);
```

**Fix:** If `team.leader_id` is known, include it in the original `Promise.all()`. However, this requires knowing `leader_id` upfront, which comes from the `team` result. Alternative: use Prisma `include` in the team query to get leader data in one query.

---

### Finding 14 (P3) — Sequential `emitEvent` in missed-check-in loop

**File:** `src/jobs/missed-check-in-detector.ts:349–366`

**Problem:** Each missed worker emits a separate event via individual `emitEvent()` calls.

**Fix:** Batch using `prisma.event.createMany()`:

```typescript
await prisma.event.createMany({
  data: newMissing.map(w => {
    const effective = getEffectiveSchedule(...);
    return buildEventData({
      companyId, personId: w.id, eventType: 'MISSED_CHECK_IN_DETECTED',
      entityType: 'missed_check_in',
      payload: { missedDate: todayStr, scheduleWindow: `${effective.checkInStart} - ${effective.checkInEnd}`, teamId: w.team_id },
      timezone,
    });
  }),
});
```

---

### Finding 15 (P3) — Pre-transaction fetch broader than needed

**File:** `src/modules/incident/incident.service.ts:157–159`

**Problem:** Fetches the entire incident record when only `status` is needed for validation.

**Fix:**

```typescript
const existing = await this.prisma.incident.findFirst({
  where: { id: incidentId, company_id: companyId },
  select: { id: true, status: true },
});
```

---

## Implementation Rollout Plan

### Phase 1 — Low Risk (No behavior change, safe refactors)

These changes reduce data fetched but produce **identical output**. Safe to deploy without feature flags.

| Finding | Change | Files | Regression Risk |
|---------|--------|-------|-----------------|
| #6 | Slim `findById` → `findByIdSlim` for validation callers | `team.repository.ts`, `team.controller.ts`, `person.controller.ts` | **Low** — return shape changes (no `members` array). Must update callers that destructure `members`. |
| #5 | Include `leader` in supervisor dashboard teams query, remove separate leaders query | `dashboard.service.ts` | **Low** — same data, fewer queries. Leader mapping code must use `team.leader` instead of `leadersMap.get()`. |
| #8 | Single-pass readiness counters (accumulate in existing loop) | `team.service.ts` | **None** — removes 3 `.filter()` calls, replaces with counters in existing loop. Output identical. |
| #15 | Add `select: { id: true, status: true }` to pre-transaction incident fetch | `incident.service.ts` | **None** — only `status` is used after this query. |

**Test Checklist — Phase 1:**
- [ ] `GET /teams/:id` — still returns full member list (uses `findByIdWithMembers`)
- [ ] `PATCH /teams/:id` — still validates leader/supervisor correctly (uses `findByIdSlim`)
- [ ] `PATCH /persons/:id` with `teamId` change — team validation still works
- [ ] Supervisor dashboard — leader names still display on each team card
- [ ] Team analytics 7d/30d/90d — readiness distribution numbers unchanged (compare before/after)
- [ ] `POST /incidents/:id/approve` — still rejects invalid transitions, still creates case

---

### Phase 2 — Moderate Risk (Parallel validations in controllers)

These change the **execution order** of validation queries. The same errors are thrown, but error **priority** may shift (e.g., if both leader and supervisor are invalid, which error the user sees first may change).

| Finding | Change | Files | Regression Risk |
|---------|--------|-------|-----------------|
| #2 | `createTeam` — wrap 4 validation queries in `Promise.all` | `team.controller.ts` | **Moderate** — error message priority may change. All validations still run. |
| #3 | `updateTeam` — parallel validations after existence check | `team.controller.ts` | **Moderate** — same as above. `leaderChanged` flag must be computed before `Promise.all`. |
| #4 | `updatePerson` — parallel team/leader/deactivation checks | `person.controller.ts` | **Moderate** — deduplicate `findByLeaderId` calls. Conditional logic must be pre-computed from `existing`. |
| #11 | Parallel event creates inside `approveIncident` transaction | `incident.service.ts` | **Low** — both events are independent INSERTs within the same transaction. Order doesn't matter. |
| #9 | Parallel holiday/check-in/missed queries in `createImmediateMissedCheckIn` | `person.controller.ts` | **Low** — fire-and-forget context. Loses short-circuit but gains speed. |

**Regression Warnings:**
- `createTeam` with BOTH invalid leader AND invalid supervisor → user may see supervisor error instead of leader error (previously always saw leader error first because it ran first)
- `updatePerson` with role change + deactivation simultaneously → `findByLeaderId` was called twice sequentially, now called once. Verify both guards still work with shared result.

**Test Checklist — Phase 2:**
- [ ] `POST /teams` with valid data — team created successfully
- [ ] `POST /teams` with invalid leader — returns `INVALID_LEADER`
- [ ] `POST /teams` with invalid supervisor — returns `INVALID_SUPERVISOR`
- [ ] `POST /teams` with duplicate name — returns `DUPLICATE_TEAM`
- [ ] `POST /teams` with leader already assigned — returns `LEADER_ALREADY_ASSIGNED`
- [ ] `PATCH /teams/:id` with leader change to already-assigned lead — returns `LEADER_ALREADY_ASSIGNED`
- [ ] `PATCH /teams/:id` deactivation with members — members unassigned correctly
- [ ] `PATCH /persons/:id` demote TEAM_LEAD who leads a team — returns `LEADER_HAS_TEAM`
- [ ] `PATCH /persons/:id` deactivate person who leads active team — returns `LEADER_HAS_ACTIVE_TEAM`
- [ ] `PATCH /persons/:id` change team + change role simultaneously — both validations fire
- [ ] `POST /incidents/:id/approve` — both INCIDENT_APPROVED and CASE_CREATED events created
- [ ] Person team reassignment triggers `createImmediateMissedCheckIn` — missed check-in created when expected

---

### Phase 3 — Highest Impact (DB aggregation redesign)

This is the biggest performance win but also the riskiest change — it fundamentally restructures how `getTeamAnalytics` works. **Must be guarded by tests and benchmarks.**

| Finding | Change | Files | Regression Risk |
|---------|--------|-------|-----------------|
| #1 | Replace `findMany` + JS aggregation with `groupBy` / `$queryRaw` + limited records query | `team.service.ts` | **High** — entire analytics response structure is rebuilt. Edge cases: empty days, single check-in days, timezone boundary dates. |
| #7 | Pre-group workers by day-of-week for compliance calculation | `team.service.ts` | **Medium** — compliance percentages must match exactly. Worker eligibility logic (assignedDate < currentDate + isWorkDay) must be preserved. |

**Regression Warnings:**
- `groupBy` does NOT support `person` relation — can't get `first_name`/`last_name` in the aggregation query. Must keep the separate `take: 200` records query for the detail table.
- `$queryRaw` returns `BigInt` for `COUNT(*)` in some Postgres/Prisma versions — must cast with `::int`.
- Timezone handling: `check_in_date` is a `Date` in Prisma. `groupBy` groups by the raw DB value, not by timezone-adjusted date. Verify the current behavior is date-only (no time component) before switching.
- Submit time calculation (`created_at` hour/minute extraction) needs `$queryRaw` — `groupBy` doesn't support `EXTRACT()`.
- Compliance rate edge case: days where `expectedWorkers === 0` but `stats.count > 0` (e.g., worker checked in on a non-work day) — current code skips these. New code must preserve this skip logic.

**Test Checklist — Phase 3:**
- [ ] **Benchmark:** Run `getTeamAnalytics` with 7d, 30d, 90d periods. Record response time and payload size before/after.
- [ ] Team analytics 7d — trends array matches day count, daily check-in counts correct
- [ ] Team analytics 30d — avgReadiness matches manual calculation
- [ ] Team analytics 90d — complianceRate percentages match (compare old vs new output row by row)
- [ ] Team analytics with single team — `teamCreatedAt` cap still works (no data before team creation)
- [ ] Team analytics with multiple teams (supervisor view) — aggregation spans all teams
- [ ] Readiness distribution — `green + yellow + red === totalCheckIns`
- [ ] Submit time format — still returns `HH:MM` string
- [ ] Records array — max 200, ordered by `check_in_date desc`, includes person name
- [ ] Empty team (no workers) — returns zeroes, no errors
- [ ] Team with workers but no check-ins for period — compliance 0%, no crash
- [ ] Day with 1 check-in — avgReadiness equals that check-in's score
- [ ] Cross-day boundary: check-in `created_at` at 23:59 vs `check_in_date` next day — correct grouping

---

### Phase 4 — Careful (Cron/background job tuning)

These affect background jobs that run on schedules. **Use concurrency limiter, NOT full batching** — individual error isolation must be preserved.

| Finding | Change | Files | Regression Risk |
|---------|--------|-------|-----------------|
| #10 | Transfer processor — use `p-limit` concurrency limiter instead of full batching | `transfer-processor.ts` | **Medium** — per-transfer error handling must be preserved. One failed transfer must NOT block others. |
| #12 | Missed-check-in detector — `p-limit` for company processing | `missed-check-in-detector.ts` | **Medium** — connection pool pressure. Start with `p-limit(2)` or `p-limit(3)`, monitor DB connections. |
| #14 | Batch `emitEvent` with `createMany` in missed-check-in loop | `missed-check-in-detector.ts` | **Low** — fire-and-forget events. `createMany` doesn't return created records, which is fine since events aren't used downstream. |
| #13 | Include leader in team query's `Promise.all` via Prisma `include` | `person.controller.ts` | **Low** — fire-and-forget notification context. |

**Why NOT full batching for transfers (Finding #10):**
```typescript
// BAD — one failure rolls back ALL transfers
await prisma.$transaction(
  validTransfers.map(t => prisma.person.update({ ... }))
);

// GOOD — controlled concurrency with individual error isolation
import pLimit from 'p-limit';
const limit = pLimit(3); // max 3 concurrent transfers

await Promise.allSettled(
  pendingTransfers.map(transfer =>
    limit(async () => {
      try {
        await personRepo.executeTransfer(transfer.id, transfer.effective_team_id, todayDate);
        // ... notifications, events
      } catch (error) {
        logger.error({ error, personId: transfer.id }, 'Failed to execute transfer');
      }
    })
  )
);
```

**Regression Warnings:**
- `p-limit` is an ESM-only package. Verify it works with the current `tsup` build config.
- Connection pool default is 5 in Prisma. Running 3 concurrent company processes may exhaust it if each process runs multiple queries. Monitor `PrismaClientKnownRequestError: Timed out fetching a new connection`.
- `createMany` for events: `buildEventData()` returns `ingested_at: new Date()` — all events in the batch will have near-identical timestamps. This is acceptable but differs from current behavior where each event has a slightly different `ingested_at`.

**Test Checklist — Phase 4:**
- [ ] Transfer processor: 1 transfer pending — executes normally
- [ ] Transfer processor: 5 transfers pending, 1 has inactive target team — 4 succeed, 1 cancelled, no rollback
- [ ] Transfer processor: transfer to non-existent team — error logged, others still process
- [ ] Missed-check-in detector: run with 2+ companies — all companies processed
- [ ] Missed-check-in detector: 1 company fails — others still complete (check logs)
- [ ] Missed-check-in detector: events created for all missed workers — verify event count matches
- [ ] Monitor DB connection pool usage during cron runs (Prisma metrics or `pg_stat_activity`)
- [ ] Notification helper: leader name still appears in team assignment notification

---

### Rollout Timeline

```
Week 1: Phase 1 (low risk) → Deploy → Monitor for 2 days
Week 1: Phase 2 (moderate) → Deploy → Run full controller test suite
Week 2: Phase 3 (highest impact) → Implement with benchmark comparison → Deploy behind feature flag if possible
Week 3: Phase 4 (careful) → Add p-limit dependency → Deploy → Monitor cron logs for 1 week
```

---

## Proper Patterns Reference

### Pattern 1: Parallel Independent Queries

**Rule:** If two or more `await` calls do NOT depend on each other's results, wrap them in `Promise.all()`.

**Benefits:**
- Reduces total response time from `sum(all queries)` to `max(single slowest query)` — typically **60–70% faster** for 3+ independent queries
- No extra DB connections used — PostgreSQL handles concurrent queries on the same connection pool
- Directly improves user-perceived latency on every endpoint that validates multiple things

**Already done well in our codebase:**
- `dashboard.service.ts:47` — worker dashboard fetches person, checkIns, holiday, holidayDateSet in parallel
- `check-in.service.ts:60` — submit fetches holiday + person in parallel
- All repository `findAll()` methods — `findMany` + `count` in parallel

```typescript
// BAD — sequential (total time = query1 + query2 + query3)
const user = await repo.findUser(id);
const team = await repo.findTeam(teamId);
const holidays = await repo.getHolidays(date);

// GOOD — parallel (total time = max(query1, query2, query3))
const [user, team, holidays] = await Promise.all([
  repo.findUser(id),
  repo.findTeam(teamId),
  repo.getHolidays(date),
]);
```

**When NOT to parallelize:**
- When query B uses the result of query A
- When early-return on query A failure saves significant wasted work (and the caller is on the hot path, not fire-and-forget)

---

### Pattern 2: Conditional Parallel Validation

**Rule:** When the first query is a required existence check, run it first, then parallelize remaining validations.

**Benefits:**
- Preserves the critical "does it exist?" guard while still parallelizing everything after it
- Reduces validation round-trips from N to 2 (one for existence, one for everything else)
- Error messages remain the same — only the *order* of which error fires first may change for multi-error cases
- Cleaner code — all conditional validations are co-located in one `Promise.all` block instead of scattered across 50+ lines

```typescript
// Step 1: Must exist first — cannot skip
const existing = await repository.findById(id);
if (!existing) throw Errors.notFound('Team');

// Step 2: Independent validations — parallel
const [leader, supervisor, nameConflict] = await Promise.all([
  data.leaderId ? repository.findPersonById(data.leaderId) : null,
  data.supervisorId ? repository.findPersonById(data.supervisorId) : null,
  data.name ? repository.findByName(data.name) : null,
]);

// Step 3: Validate results
if (data.leaderId && !leader) throw Errors.notFound('Leader');
if (data.supervisorId && !supervisor) throw Errors.notFound('Supervisor');
if (nameConflict && nameConflict.id !== id) throw Errors.conflict('Team name exists');
```

---

### Pattern 3: DB-Level Aggregation Over App-Level

**Rule:** Never fetch N rows to count/sum/average in JavaScript when the DB can return the aggregate directly.

**Benefits:**
- **Massive data transfer reduction** — 90 aggregated rows vs 9,000 raw rows (100x less data over the wire)
- **Lower Node.js memory pressure** — V8 doesn't allocate 9,000 objects just to count them
- **PostgreSQL is optimized for aggregation** — index scans, parallel workers, columnar access patterns all benefit
- **Response time scales with days, not with workers** — adding 50 more workers doesn't slow down the query
- **Lower GC pauses** — fewer short-lived objects means fewer garbage collection cycles during the request

**Already done well in our codebase:**
- `dashboard.service.ts:527` — supervisor dashboard uses batch queries with `findMany` + post-processing on bounded sets
- All pagination repos — use `count()` instead of fetching all rows and checking `.length`

```typescript
// BAD — fetches 9,000 rows to count in JS
const checkIns = await prisma.checkIn.findMany({ where: { ... } });
const greenCount = checkIns.filter(c => c.readiness_level === 'GREEN').length;
const avgScore = checkIns.reduce((s, c) => s + c.readiness_score, 0) / checkIns.length;

// GOOD — Prisma groupBy (DB returns ~90 rows)
const dailyStats = await prisma.checkIn.groupBy({
  by: ['check_in_date'],
  where: { company_id: companyId, check_in_date: { gte: start, lte: end } },
  _count: true,
  _avg: { readiness_score: true },
});

// GOOD — raw SQL for complex aggregation (green/yellow/red + submit time)
const stats = await prisma.$queryRaw`
  SELECT
    check_in_date,
    COUNT(*)::int AS count,
    ROUND(AVG(readiness_score))::int AS avg_score,
    SUM(CASE WHEN readiness_level = 'GREEN' THEN 1 ELSE 0 END)::int AS green
  FROM "CheckIn"
  WHERE company_id = ${companyId}
  GROUP BY check_in_date
`;
```

**When app-level aggregation is acceptable:**
- The dataset is small and bounded (< 100 rows)
- The aggregation logic requires application state (e.g., schedule-aware compliance with per-worker overrides)
- You need the individual rows anyway (e.g., for a detail table)

---

### Pattern 4: Lean Queries with `select`

**Rule:** Only fetch the columns you actually use. Create slim variants for commonly-called methods.

**Benefits:**
- **Less data transferred from DB** — fetching 4 columns instead of 20+ columns per row reduces I/O
- **Smaller Prisma object allocation** — each `select` field becomes a JS property; fewer fields = smaller objects
- **Faster serialization** — less JSON to stringify when sending the response
- **Clearer intent** — reading `findByIdSlim` immediately tells the developer "this is a lightweight check"
- **No accidental coupling** — callers that only need metadata can't accidentally rely on `members` array

**Already done well in our codebase:**
- `check-in.service.ts` — `getPersonWithTeam` uses targeted `select` for schedule fields only
- `dashboard.service.ts:49-61` — worker dashboard selects only schedule-relevant person fields

```typescript
// BAD — findById loads 20 columns + all members for a simple existence check
const team = await repository.findById(id);
if (!team) throw Errors.notFound('Team');

// GOOD — slim method for validation
async findByIdSlim(id: string) {
  return this.prisma.team.findFirst({
    where: this.where({ id }),
    select: { id: true, name: true, is_active: true, leader_id: true },
  });
}

// FULL — only for GET detail endpoints that actually display members
async findByIdWithMembers(id: string) {
  return this.prisma.team.findFirst({
    where: this.where({ id }),
    include: {
      members: { where: { is_active: true }, select: { id: true, first_name: true, last_name: true } },
    },
  });
}
```

---

### Pattern 5: Use `include` Instead of Separate Queries

**Rule:** When you need related data, use Prisma's `include` or nested `select` instead of fetching the relation in a separate query.

**Benefits:**
- **1 query instead of 2** — Prisma generates a single SQL JOIN or correlated subquery
- **Eliminates the mapping step** — no need to build a `Map` or loop to associate parent with child records
- **Atomic data snapshot** — both parent and child data come from the same point in time (no race condition between queries)
- **Less code** — removes the `leaderIds` extraction, separate `findMany`, and manual mapping logic

**Already done well in our codebase:**
- `person.controller.ts:43` — `notifyWorkerTeamAssignment` fetches team + person in parallel (good)
- `check-in.service.ts` — check-in create uses `include: { person: { select: {...} } }` to return person info with the check-in

```typescript
// BAD — 2 queries + manual mapping
const teams = await prisma.team.findMany({ where: { ... } });
const leaderIds = teams.map(t => t.leader_id).filter(Boolean);
const leaders = await prisma.person.findMany({ where: { id: { in: leaderIds } } });

// GOOD — 1 query with include (Prisma generates a JOIN or correlated subquery)
const teams = await prisma.team.findMany({
  where: { ... },
  select: {
    id: true, name: true,
    leader: { select: { id: true, first_name: true, last_name: true } },
  },
});
```

---

### Pattern 6: Batch Writes Instead of Loops

**Rule:** Never `await` individual creates/updates inside a loop. Use `createMany`, `updateMany`, or `$transaction` with batched operations.

**Benefits:**
- **N round-trips → 1 round-trip** — a single `createMany` with 50 items is one SQL statement, not 50
- **Reduced connection pool pressure** — one connection handles the entire batch, freeing pool for other requests
- **Atomic batching with `$transaction`** — either all updates succeed or none do (useful for transfers)
- **Significantly faster for cron jobs** — missed-check-in detector with 200 workers: 200 inserts → 1 `createMany`
- **Predictable execution time** — batch time is roughly constant regardless of N, unlike sequential which scales linearly

**Already done well in our codebase:**
- `missed-check-in-detector.ts:286` — uses `createManyAndReturn` for batch missed check-in inserts
- `missed-check-in-detector.ts:341` — uses `notifRepo.createMany()` for batch notifications
- `team.controller.ts:240-260` — deactivation uses `updateMany` for bulk member unassignment

```typescript
// BAD — N sequential inserts
for (const item of items) {
  await prisma.event.create({ data: buildEventData(item) });
}

// GOOD — single batch insert
await prisma.event.createMany({
  data: items.map(item => buildEventData(item)),
});

// GOOD — batched updates in a transaction (when each row needs different data)
await prisma.$transaction(
  items.map(item =>
    prisma.person.update({ where: { id: item.id }, data: { team_id: item.newTeamId } })
  )
);

// GOOD — single updateMany (when all rows get the same data)
await prisma.person.updateMany({
  where: { id: { in: ids } },
  data: { effective_team_id: null, effective_transfer_date: null },
});
```

---

### Pattern 7: Single-Pass Aggregation

**Rule:** When you must iterate an array, compute all needed aggregates in one pass. Never scan the same array multiple times.

**Benefits:**
- **O(n) instead of O(n × k)** — where k is the number of separate filter/reduce calls. For 9,000 items with 4 passes, that's 36,000 iterations → 9,000
- **CPU cache friendly** — iterating an array once keeps it in L1/L2 cache; multiple passes cause cache evictions
- **Easier to maintain** — all aggregation logic is in one place, not scattered across multiple `.filter()` chains
- **Scales better with data growth** — the difference between 1 pass and 4 passes is negligible at 100 items but significant at 10,000+

```typescript
// BAD — 4 passes over the same array
const total = items.reduce((s, i) => s + i.score, 0);
const green = items.filter(i => i.level === 'GREEN').length;
const yellow = items.filter(i => i.level === 'YELLOW').length;
const red = items.filter(i => i.level === 'RED').length;

// GOOD — single pass
let total = 0, green = 0, yellow = 0, red = 0;
for (const item of items) {
  total += item.score;
  if (item.level === 'GREEN') green++;
  else if (item.level === 'YELLOW') yellow++;
  else red++;
}
```

---

### Pattern 8: Narrow Transaction Scope

**Rule:** Only include operations that MUST be atomic inside `$transaction`. Move fire-and-forget operations (events, notifications, audits) outside when they don't need to be rolled back with the main operation.

**Benefits:**
- **Shorter lock duration** — rows are locked for the minimum time necessary, reducing contention under concurrent load
- **Higher throughput** — other requests waiting for the same rows get access sooner
- **Better failure isolation** — if a notification fails, the main business operation still succeeds
- **Prevents "transaction too long" timeouts** — Prisma's default transaction timeout is 5s; non-critical ops can push past that under load
- **Clearer code intent** — what's inside the transaction is the business invariant; what's outside is side effects

**Already done well in our codebase:**
- `check-in.service.ts` — `emitEvent(MISSED_CHECK_IN_RESOLVED)` is correctly placed outside the check-in transaction
- `incident.service.ts:254-265` — `logAudit` and notification are fire-and-forget after the approve transaction
- All controllers — `logAudit()` is never awaited, never inside transactions

```typescript
// BAD — notification inside transaction holds locks longer
const result = await prisma.$transaction(async (tx) => {
  const updated = await tx.person.update({ ... });
  await tx.notification.create({ ... });   // Non-critical, extends lock duration
  return updated;
});

// GOOD — transaction only holds what's atomic
const result = await prisma.$transaction(async (tx) => {
  return tx.person.update({ ... });
});
// Fire-and-forget AFTER transaction releases locks
notifyUser(result.id);
emitEvent(prisma, { ... });
```

**When to keep operations inside the transaction:**
- The operation is part of the business invariant (e.g., creating a case when approving an incident — case MUST exist if incident is APPROVED)
- You need the operation to roll back if the main operation fails (e.g., event create for incident_approved + case_created are both required for audit trail integrity)

---

### Pattern 9: Parallelize Within Transactions

**Rule:** Independent operations within a `$transaction` callback can still use `Promise.all()`.

**Benefits:**
- **Shorter total transaction time** — two 5ms INSERTs run in 5ms instead of 10ms
- **Same atomicity guarantees** — `Promise.all` inside a transaction still rolls back everything if any operation fails
- **Reduces lock contention** — the transaction releases its locks sooner, benefiting other concurrent requests
- **Compounds with Pattern 8** — narrower scope + parallel ops = minimum possible lock duration

```typescript
// BAD — sequential inside transaction (10ms total)
await prisma.$transaction(async (tx) => {
  const updated = await tx.incident.update({ ... });
  await tx.event.create({ data: buildEventData({ eventType: 'INCIDENT_APPROVED' }) }); // 5ms
  await tx.event.create({ data: buildEventData({ eventType: 'CASE_CREATED' }) });      // 5ms
  return updated;
});

// GOOD — parallelize independent ops within the transaction (5ms total for events)
await prisma.$transaction(async (tx) => {
  const updated = await tx.incident.update({ ... });
  await Promise.all([
    tx.event.create({ data: buildEventData({ eventType: 'INCIDENT_APPROVED' }) }),
    tx.event.create({ data: buildEventData({ eventType: 'CASE_CREATED' }) }),
  ]);
  return updated;
});
```

---

## Benefits Summary

| Pattern | Primary Benefit | Estimated Impact |
|---------|----------------|------------------|
| 1. Parallel Queries | Faster response time | **60–70%** latency reduction on multi-query endpoints |
| 2. Conditional Parallel Validation | Faster CRUD operations | **15–45ms** saved per create/update request |
| 3. DB-Level Aggregation | Less data transfer + memory | **~100x** fewer rows for analytics endpoints |
| 4. Lean `select` | Less I/O per query | **30–50%** less data per query on over-fetched methods |
| 5. `include` over Separate Queries | Fewer round-trips | **1 query instead of 2** — eliminates mapping code |
| 6. Batch Writes | Fewer round-trips for writes | **N round-trips → 1** for bulk inserts/updates |
| 7. Single-Pass Aggregation | Less CPU usage | **k× fewer iterations** (k = number of filter passes removed) |
| 8. Narrow Transaction Scope | Lower lock contention | Shorter lock duration → **higher concurrent throughput** |
| 9. Parallel in Transactions | Shorter transaction time | **Additive with Pattern 8** — minimum lock window |

### Compound Effect

These patterns are not isolated — they compound:
- Applying Pattern 1 + 2 to `createTeam` → validation step goes from ~60ms (4 sequential) to ~15ms (1 existence + 1 parallel batch)
- Applying Pattern 3 + 7 to `getTeamAnalytics` → data transfer drops from ~9,000 rows to ~90, AND the remaining app-level loop runs in 1 pass instead of 4
- Applying Pattern 8 + 9 to `approveIncident` → transaction holds locks for the minimum possible time, improving throughput under concurrent WHS officer approvals

---

## Quick Decision Checklist

Before writing any `await` in a service or controller, ask yourself:

| # | Question | If Yes | Benefit |
|---|----------|--------|---------|
| 1 | Does this `await` depend on the previous `await`? | Keep sequential. Otherwise → `Promise.all()` | Faster response |
| 2 | Am I fetching rows just to count/sum/avg them? | Use `groupBy` or raw SQL aggregation | Less memory + data transfer |
| 3 | Am I querying the same entity twice in one flow? | Pass the data through instead of re-fetching | Fewer queries |
| 4 | Am I `await`-ing inside a loop? | Batch with `createMany` / `$transaction` / `updateMany` | N queries → 1 |
| 5 | Does this `include` load data I don't use? | Use `select` instead, or create a slim variant | Less I/O |
| 6 | Is this non-critical (audit, notification)? | Fire-and-forget, keep outside `$transaction` | Shorter locks |
| 7 | Am I filtering the same array multiple times? | Single-pass accumulation in one `for` loop | Less CPU |
