# Prisma Performance Audit — AEGIRA V5

**Date**: 2026-02-07
**Scope**: Every Prisma query in `aegira-backend/src/`
**Auditor**: Senior Engineer Review
**Method**: Traced every query to its consumer, verified field usage downstream
**Last Updated**: 2026-02-07

---

## Resolution Status

| # | Priority | Issue | Status | Resolved In |
|---|----------|-------|--------|-------------|
| 1 | P0 | `password_hash` sent to frontend | RESOLVED | `person.repository.ts` — `SAFE_PERSON_SELECT` constant excludes `password_hash` |
| 2 | P1 | Login over-fetching ~15 cols | RESOLVED | `auth.controller.ts` — `select` with exact fields + `company: { select: { name, timezone } }` |
| 3 | P1 | getMe over-fetching ~15 cols | RESOLVED | `auth.controller.ts` — `select` with exact fields (same as login minus `password_hash`) |
| 4 | P1 | Worker dashboard 11 unused cols × 30 rows | RESOLVED | `dashboard.service.ts` — `select` with 9 fields actually used |
| 5 | P1 | Team lead check-ins unused person JOIN | RESOLVED | `dashboard.service.ts` — replaced `include` with `select: { person_id, readiness_score, readiness_level, created_at }` |
| 6 | P1 | Signup email check fetches full Person | RESOLVED | `auth.controller.ts` — `select: { id: true }` |
| 7 | P1 | Missed check-in findById fetches 22+ cols | RESOLVED | `missed-check-in.repository.ts` — `select: { id: true, status: true }` |
| 8 | P1 | Holiday `@@index` should be `@@unique` | RESOLVED | `schema.prisma` — changed to `@@unique([company_id, date])` |
| 9 | P1 | 5 missing indexes | RESOLVED | `schema.prisma` — added all 5 indexes (see section 4) |
| 10 | P2 | `getTeamSummary` 6 queries | RESOLVED | `dashboard.service.ts` — `groupBy(['readiness_level'])` with `_count` + `_avg`, 6 → 2 queries |
| 11 | P2 | `getSummary` 6 queries | RESOLVED | `dashboard.service.ts` — `groupBy(['is_active'])` + `groupBy(['role'])`, 6 → 3 queries |
| 12 | P3 | Dead `findWithoutCheckInToday` method | OPEN | `person.repository.ts` — safe to delete |
| 13 | P3 | Dead amendments backend code | OPEN | Decision needed: remove or keep for future use |

---

## Table of Contents

1. [SECURITY: password_hash Exposure](#0-security-password_hash-exposed-to-frontend)
2. [Dead Code: Amendments Feature](#1-dead-code-amendments-feature)
3. [Queries Missing `select` (Over-fetching)](#2-queries-missing-select-over-fetching)
4. [N+1 & Redundant Query Patterns](#3-n1--redundant-query-patterns)
5. [Missing Indexes in `schema.prisma`](#4-missing-indexes-in-schemaprisma)
6. [Bulk Operation Opportunities](#5-bulk-operation-opportunities-transaction--queryraw)
7. [`updateMany` Misuse Analysis](#6-updatemany-misuse-analysis)
8. [Summary Action Plan](#7-summary-action-plan)

---

## 0. SECURITY: `password_hash` Exposed to Frontend

**Severity**: HIGH
**Status**: RESOLVED

`PersonRepository` now uses a `SAFE_PERSON_SELECT` constant that explicitly
lists all safe fields and **excludes `password_hash`**. This constant is used
by `findById()`, `findAll()`, and all other repository methods that return
person data to controllers.

```typescript
// person.repository.ts — SAFE_PERSON_SELECT (current implementation)
const SAFE_PERSON_SELECT = {
  id: true,
  company_id: true,
  email: true,
  first_name: true,
  last_name: true,
  gender: true,
  date_of_birth: true,
  profile_picture_url: true,
  role: true,
  team_id: true,
  team_assigned_at: true,
  is_active: true,
  created_at: true,
  updated_at: true,
  // password_hash: EXCLUDED
} as const;

export type SafePerson = Omit<Person, 'password_hash'>;
```

### Previously Affected Endpoints (now safe)

| Controller | Endpoint | How Fixed |
|------------|----------|-----------|
| `person.controller.ts` | `GET /persons/:id` | Uses `SAFE_PERSON_SELECT` via repository |
| `person.controller.ts` | `GET /persons/me` | Uses `SAFE_PERSON_SELECT` via repository |
| `person.controller.ts` | `GET /persons` | Uses `SAFE_PERSON_SELECT` via repository |
| `person.controller.ts` | `POST /persons` | Uses `SAFE_PERSON_SELECT` via repository |
| `person.controller.ts` | `PATCH /persons/:id` | Uses `SAFE_PERSON_SELECT` via repository |
| `person.controller.ts` | `PATCH /persons/me` | Uses `SAFE_PERSON_SELECT` via repository |

### Already Safe (unchanged)

| Controller | Why Safe |
|------------|---------|
| `auth.controller.ts` login/getMe | Uses `formatUserResponse()` which explicitly picks fields |
| `auth.controller.ts` changePassword | Uses `select: { id: true, password_hash: true }` |
| `check-in.controller.ts` | Person relation uses `select: { id, first_name, last_name, email }` |
| `missed-check-in.controller.ts` | Transforms response, picks only safe fields |

---

## 1. Dead Code: Amendments Feature

**Status**: CONFIRMED DEAD CODE — OPEN (decision pending)

### Evidence

**Frontend** — fully removed:
- `AdminAmendmentsPage.tsx` — DELETED (documented in `IMPLEMENTATION_PROGRESS.md`)
- `routes.config.ts` — no `ADMIN_AMENDMENTS` route
- `endpoints.ts` — no `AMENDMENTS`, `AMENDMENT_APPROVE`, `AMENDMENT_REJECT`
- `Sidebar.tsx` — no Amendments navigation item
- `routes/index.tsx` — no lazy import or route definition

**Backend** — still fully implemented but orphaned:
- `admin.routes.ts:32-35` — 3 endpoints still registered
- `admin.controller.ts:363-510` — `listAmendments`, `approveAmendment`, `rejectAmendment`
- `admin.validator.ts:37-39` — `rejectAmendmentSchema`
- `schema.prisma` — `Amendment` model + `AmendmentStatus` enum + indexes

**The backend endpoints exist and work**, but no frontend code calls them.
No user can access them through the UI. The only remaining frontend reference
is `pendingAmendments: 3` in test mock data (`handlers.ts:336`).

### Recommendation

If amendments will not return, consider removing:

1. `admin.routes.ts` — delete lines 32-35 (3 routes)
2. `admin.controller.ts` — delete lines 363-510 (3 functions)
3. `admin.validator.ts` — delete `rejectAmendmentSchema` and its type export
4. `schema.prisma` — drop `Amendment` model, `AmendmentStatus` enum, and related indexes
5. Run migration to drop the `amendments` table
6. `handlers.ts:336` — remove `pendingAmendments` from mock data

If amendments might return later, **leave the schema/migration** and only remove
the dead controller+routes code. The table can sit empty at zero cost.

---

## 2. Queries Missing `select` (Over-fetching)

### RESOLVED — All Critical Over-fetching Fixed

#### 2.1 `auth.controller.ts` — Login

**Status**: RESOLVED

Now uses explicit `select` with only the fields needed for `formatUserResponse`,
password verification, token generation, and audit logging:

```typescript
// auth.controller.ts — login (current implementation)
const person = await prisma.person.findFirst({
  where: { email: email.toLowerCase() },
  select: {
    id: true,
    email: true,
    first_name: true,
    last_name: true,
    gender: true,
    date_of_birth: true,
    profile_picture_url: true,
    role: true,
    company_id: true,
    is_active: true,
    password_hash: true,
    company: { select: { name: true, timezone: true } },
  },
});
```

---

#### 2.2 `auth.controller.ts` — getMe

**Status**: RESOLVED

Same `select` as login minus `password_hash` (not needed for getMe).

---

#### 2.3 `auth.controller.ts` — Signup email existence check

**Status**: RESOLVED

```typescript
// auth.controller.ts — signup (current implementation)
const existingPerson = await prisma.person.findFirst({
  where: { email: email.toLowerCase() },
  select: { id: true },
});
```

---

#### 2.4 `dashboard.service.ts` — Worker dashboard (30 days of check-ins)

**Status**: RESOLVED

Now selects only the 9 fields actually accessed downstream (lines 118-215),
skipping 10 unused columns per row:

```typescript
// dashboard.service.ts — getWorkerDashboard (current implementation)
const recentCheckIns = await prisma.checkIn.findMany({
  where: { ... },
  select: {
    id: true,
    check_in_date: true,
    readiness_score: true,
    readiness_level: true,
    hours_slept: true,
    sleep_quality: true,
    physical_condition: true,
    stress_level: true,
    created_at: true,
  },
  orderBy: { check_in_date: 'desc' },
});
```

**Fields no longer fetched**: `company_id`, `person_id`, `event_id`, `pain_level`,
`pain_location`, `physical_condition_notes`, `notes`, `sleep_score`,
`stress_score`, `physical_score`, `pain_score`

---

#### 2.5 `dashboard.service.ts` — Team lead dashboard check-ins

**Status**: RESOLVED

Removed the unused `person` include entirely. Team member info comes from the
separate `teamMembers` query — the person JOIN on check-ins was never accessed.

```typescript
// dashboard.service.ts — getTeamLeadDashboard (current implementation)
prisma.checkIn.findMany({
  where: { ... },
  select: {
    person_id: true,
    readiness_score: true,
    readiness_level: true,
    created_at: true,
  },
})
```

---

#### 2.6 `person.repository.ts` — `findWithoutCheckInToday`

**Status**: OPEN — DEAD CODE

This method exists in the repository but is **never called anywhere in the
codebase**. The missed check-in detector uses its own queries directly.
Safe to delete.

---

#### 2.7 `missed-check-in.repository.ts` — `findById`

**Status**: RESOLVED

```typescript
// missed-check-in.repository.ts — findById (current implementation)
return this.prisma.missedCheckIn.findFirst({
  where: this.where({ id }),
  select: { id: true, status: true },
});
```

Only `id` and `status` are needed — the caller checks existence and reads status.

---

### Summary: Over-fetching Resolution

| Query | Unused Fields | Status | Data Saved |
|-------|--------------|--------|------------|
| Login | ~15 cols | RESOLVED | Medium — per session |
| getMe | ~15 cols | RESOLVED | Medium — per page load |
| Worker dashboard | 10 cols × 30 rows | RESOLVED | High — per worker visit |
| Team lead check-ins | Entire person JOIN | RESOLVED | High — per team lead visit |
| Person findById | password_hash | RESOLVED | Security fix |
| Person findAll | password_hash × N | RESOLVED | Security fix |
| Signup email check | Full Person for existence check | RESOLVED | Low — per signup |
| Missed check-in findById | 20+ cols for validation | RESOLVED | Low — per status update |

---

## 3. N+1 & Redundant Query Patterns

### 3.1 `getTeamSummary` — RESOLVED: 6 queries → 2

**Status**: RESOLVED

Replaced 5 separate `count()` queries + 1 `aggregate()` with a single
`groupBy(['readiness_level'])` that provides `_count` and `_avg` in one scan.

```typescript
// dashboard.service.ts — getTeamSummary (current implementation)
const [memberCount, readinessGroups] = await Promise.all([
  prisma.person.count({
    where: { company_id: this.companyId, team_id: teamId, is_active: true },
  }),
  prisma.checkIn.groupBy({
    by: ['readiness_level'],
    where: {
      company_id: this.companyId,
      check_in_date: today,
      person: { team_id: teamId },
    },
    _count: { id: true },
    _avg: { readiness_score: true },
  }),
]);

// Derive totals from the single groupBy result
let checkedInCount = 0;
let weightedScoreSum = 0;
const readinessDistribution = { green: 0, yellow: 0, red: 0 };

for (const group of readinessGroups) {
  const count = group._count.id;
  checkedInCount += count;
  weightedScoreSum += (group._avg.readiness_score ?? 0) * count;

  if (group.readiness_level === 'GREEN') readinessDistribution.green = count;
  else if (group.readiness_level === 'YELLOW') readinessDistribution.yellow = count;
  else if (group.readiness_level === 'RED') readinessDistribution.red = count;
}

const averageReadiness = checkedInCount > 0
  ? Math.round(weightedScoreSum / checkedInCount)
  : 0;
```

**Queries**: 6 → 2. Return type `TeamSummary` preserved exactly.

---

### 3.2 `getSummary` — RESOLVED: 6 queries → 3

**Status**: RESOLVED

Replaced 6 separate `count()` queries with 2 `groupBy` queries + 1 count:

```typescript
// dashboard.service.ts — getSummary (current implementation)
const [teamCounts, roleCounts, unassignedWorkers] = await Promise.all([
  prisma.team.groupBy({
    by: ['is_active'],
    where: companyFilter,
    _count: { id: true },
  }),
  prisma.person.groupBy({
    by: ['role'],
    where: { ...companyFilter, is_active: true },
    _count: { id: true },
  }),
  // Kept separate — unassigned has extra team_id IS NULL condition
  prisma.person.count({
    where: { ...companyFilter, role: 'WORKER', is_active: true, team_id: null },
  }),
]);

const activeTeams = teamCounts.find(t => t.is_active)?._count.id ?? 0;
const inactiveTeams = teamCounts.find(t => !t.is_active)?._count.id ?? 0;
const totalWorkers = roleCounts.find(r => r.role === 'WORKER')?._count.id ?? 0;
const totalTeamLeads = roleCounts.find(r => r.role === 'TEAM_LEAD')?._count.id ?? 0;
const totalSupervisors = roleCounts.find(r => r.role === 'SUPERVISOR')?._count.id ?? 0;
```

**Queries**: 6 → 3. Return type `AdminDashboardSummary` preserved exactly.

---

### 3.3 Verified: NO N+1 Loops Exist

| File | Pattern | Verified |
|------|---------|----------|
| `missed-check-in-detector.ts` | Bulk fetch → in-memory filter → `createMany` | Clean |
| `missed-check-in-snapshot.service.ts` | `calculateBatch` — 2 bulk queries → in-memory calc | Clean |
| `dashboard.service.ts:394-520` | Supervisor dashboard — 3 batch queries via `Promise.all` | Clean |
| `whs-analytics.service.ts` | 9 parallel queries + in-memory pivoting | Clean |
| All paginated endpoints | `Promise.all([findMany, count])` | Clean |

---

## 4. Missing Indexes in `schema.prisma`

### ALL RESOLVED

#### 4.1 Holiday — Unique constraint (data integrity fix)

**Status**: RESOLVED

```prisma
// schema.prisma — Holiday (current)
@@unique([company_id, date])  // Was @@index — now prevents duplicate holidays
```

---

#### 4.2 MissedCheckIn — Compound index for team-scoped status queries

**Status**: RESOLVED

```prisma
// schema.prisma — MissedCheckIn (added)
@@index([company_id, team_id, status])  // Team-scoped status queries (countByStatus)
```

---

#### 4.3 MissedCheckIn — FK index on `resolved_by`

**Status**: RESOLVED

```prisma
// schema.prisma — MissedCheckIn (added)
@@index([resolved_by])  // FK: onDelete SetNull cascade performance
```

---

#### 4.4 Incident — Indexes for analytics groupBy queries

**Status**: RESOLVED

```prisma
// schema.prisma — Incident (added)
@@index([company_id, incident_type, created_at])  // Analytics groupBy on incident_type
@@index([company_id, severity, created_at])        // Analytics groupBy on severity
```

---

#### 4.5 AuditLog — Index for entity history lookup

**Status**: RESOLVED

```prisma
// schema.prisma — AuditLog (added)
@@index([company_id, entity_type, entity_id])  // Entity history lookup
```

---

### MODERATE PRIORITY

#### 4.6 Amendment — FK index on `reviewed_by` (if keeping the feature)

**Status**: OPEN — depends on amendment feature decision

```prisma
@@index([reviewed_by])
```

Same cascade concern as 4.3. Skip if removing the feature entirely.

---

### Migration Required

All schema changes require running `npx prisma migrate dev` to apply to the
database. The changes are:

- Holiday: `@@index([company_id, date])` → `@@unique([company_id, date])`
- MissedCheckIn: +2 indexes (`[company_id, team_id, status]`, `[resolved_by]`)
- Incident: +2 indexes (`[company_id, incident_type, created_at]`, `[company_id, severity, created_at]`)
- AuditLog: +1 index (`[company_id, entity_type, entity_id]`)

---

## 5. Bulk Operation Opportunities (`$transaction` + `$queryRaw`)

### 5.1 `getTeamSummary` — RESOLVED via `groupBy` (Prisma-native)

**Status**: RESOLVED — used Prisma `groupBy` approach (section 3.1) instead
of raw SQL. Reduces queries from 6 → 2 while maintaining type safety and
Prisma's query builder benefits.

The raw SQL alternative below is documented for reference if further optimization
is needed at extreme scale:

```typescript
// Alternative: raw SQL (not implemented — groupBy is sufficient)
const [stats] = await prisma.$queryRaw<TeamStatsRow[]>`
  SELECT
    (SELECT COUNT(*) FROM persons
     WHERE company_id = ${this.companyId} AND team_id = ${teamId} AND is_active = true
    )::int AS member_count,
    COUNT(*)::int AS checked_in_count,
    COALESCE(AVG(ci.readiness_score), 0)::float AS avg_readiness,
    COUNT(*) FILTER (WHERE ci.readiness_level = 'GREEN')::int AS green_count,
    COUNT(*) FILTER (WHERE ci.readiness_level = 'YELLOW')::int AS yellow_count,
    COUNT(*) FILTER (WHERE ci.readiness_level = 'RED')::int AS red_count
  FROM check_ins ci
  JOIN persons p ON p.id = ci.person_id
  WHERE ci.company_id = ${this.companyId}
    AND ci.check_in_date = ${today}
    AND p.team_id = ${teamId}
`;
```

---

### 5.2 `getSummary` — RESOLVED via `groupBy` (Prisma-native)

**Status**: RESOLVED — used Prisma `groupBy` approach (section 3.2) instead
of raw SQL. Reduces queries from 6 → 3 while maintaining type safety.

---

### 5.3 Already Optimized (no changes needed)

| File | Pattern | Status |
|------|---------|--------|
| `missed-check-in.repository.ts:56-84` | `createMany` with `skipDuplicates` | Optimal |
| `notification.repository.ts:32-41` | `createMany` for batch notifications | Optimal |
| `whs-analytics.service.ts:74-174` | 9 parallel queries via `Promise.all` | Optimal |
| `incident.service.ts:49-87` | `$transaction` with retry for sequence | Correct |
| `admin.controller.ts:443-487` | `$transaction` for atomic amendment approval | Correct |

---

## 6. `updateMany` Misuse Analysis

**Status**: NO ACTION NEEDED — all uses are valid.

Three places use `updateMany` for single-record updates. All three were verified:

### 6.1 `admin.controller.ts:200` — Holiday update

- **Returns**: `{ message: 'Holiday updated' }` — no record data needed
- **Why `updateMany`**: Scopes by `{ id, company_id }` for tenant isolation
- **Can change to `update`?**: YES — `id` is the PK (globally unique UUID)
- **Risk**: LOW — response doesn't use the updated record
- **Verdict**: Acceptable as-is. Change only if you want to return the updated holiday.

### 6.2 `admin.controller.ts:495-503` — Amendment rejection

- **Returns**: `{ message: 'Amendment rejected' }` — no record data
- **Why `updateMany`**: Scopes by `{ id, company_id, status: 'PENDING' }` — three conditions
- **Can change to `update`?**: NOT RECOMMENDED — the `status: 'PENDING'` guard
  makes this an atomic check-and-update. Using `update` would require a separate
  `findFirst` to verify status, creating a race condition window.
- **Verdict**: Keep `updateMany`. The multi-condition WHERE is intentional.

### 6.3 `admin.controller.ts:556-558` — User role update

- **Returns**: `{ message: 'Role updated' }` — no record data
- **Why `updateMany`**: Scopes by `{ id, company_id }`
- **Can change to `update`?**: YES — `id` is PK, and `PersonRepository.update()`
  already uses `prisma.person.update({ where: { id, company_id } })` elsewhere
- **Verdict**: Acceptable as-is. Change if you want consistency with PersonRepository.

**Bottom line**: None of these are bugs. The `updateMany` pattern is a valid
tenant-scoping technique when you don't need the returned record. Only 6.2
has a functional reason to keep `updateMany` (atomic status guard).

---

## 7. Summary Action Plan

### P0 — Security Fix

| # | Issue | Status | Files |
|---|-------|--------|-------|
| 1 | `password_hash` sent to frontend | RESOLVED | `person.repository.ts` — `SAFE_PERSON_SELECT` excludes `password_hash` |

### P1 — Quick Wins

| # | Change | Status | Files |
|---|--------|--------|-------|
| 2 | Add `select` to login | RESOLVED | `auth.controller.ts` |
| 3 | Add `select` to getMe | RESOLVED | `auth.controller.ts` |
| 4 | Add `select` to worker dashboard check-ins | RESOLVED | `dashboard.service.ts` |
| 5 | Remove unused person include from team lead dashboard | RESOLVED | `dashboard.service.ts` |
| 6 | Add `select` to signup email check | RESOLVED | `auth.controller.ts` |
| 7 | Add `select` to missed-check-in findById | RESOLVED | `missed-check-in.repository.ts` |
| 8 | Holiday `@@unique([company_id, date])` | RESOLVED | `schema.prisma` |
| 9 | Add 5 missing indexes | RESOLVED | `schema.prisma` |

### P2 — Query Reduction

| # | Change | Status | Queries Saved | Files |
|---|--------|--------|---------------|-------|
| 10 | `getTeamSummary` — `groupBy` replaces 5 counts + 1 aggregate | RESOLVED | 6 → 2 | `dashboard.service.ts` |
| 11 | `getSummary` — `groupBy` replaces 6 counts | RESOLVED | 6 → 3 | `dashboard.service.ts` |

### P3 — Cleanup (Still Open)

| # | Change | Status | Files |
|---|--------|--------|-------|
| 12 | Remove dead `findWithoutCheckInToday` method | OPEN | `person.repository.ts` |
| 13 | Remove dead amendments backend code (if not returning) | OPEN | `admin.controller.ts`, `admin.routes.ts`, `admin.validator.ts`, `schema.prisma` |
