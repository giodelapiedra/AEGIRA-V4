# AEGIRA V5 — Performance Audit & Optimization Plan

> **Date**: 2026-02-12
> **Stack**: Node.js + Hono / Prisma 5.22.0 / PostgreSQL (Supabase) / React + Vite
> **Reported Symptom**: API response time consistently ~3 seconds on every request

---

## 1. Problem Classification

**Type**: Compound latency — not a single bottleneck but multiple layers adding up.

| Layer | Contribution | Confidence |
|-------|-------------|------------|
| Network (Supabase roundtrip) | ~1–2s | 90% |
| No caching (every request = fresh DB hit) | ~0.5–1s | 85% |
| ORM overhead (Prisma query engine) | ~0.2–0.5s | 75% |
| Query fan-out (dashboard = 3–8 queries) | ~0.3–0.5s | 70% |

The ~3s is consistent (not intermittent), which rules out cold starts and points to **per-request overhead that compounds across layers**.

---

## 2. Root Cause Analysis

### #1 — Supabase Connection Latency (Network Layer)

**Evidence in codebase**:
- `prisma/schema.prisma` → pooled `url` goes through Supavisor (pgBouncer)
- `config/database.ts` → no connection warm-up, no keep-alive
- Pool params only documented as a comment, not enforced

**Why it causes ~3s**:
- Each Prisma query = 1 roundtrip through pgBouncer → Supabase PG
- If Supabase region ≠ backend region: +100–300ms per roundtrip
- Typical auth request flow: **1 tenant query + 2 business queries + 1 count** = 4 roundtrips
- 4 × 300ms = **1.2s minimum** from network alone

---

### #2 — Zero Caching (Architecture Layer)

**Evidence in codebase**:
- `middleware/tenant.ts:18` → `prisma.company.findUnique()` runs on **every authenticated request**
- Company data (name, timezone, is_active) changes maybe once a month
- `shared/holiday.utils.ts` → holiday check hits DB on every check-in submission
- `shared/schedule.utils.ts` → schedule resolution also queries per-request
- No Redis, no `node-cache`, no `Map`-based cache anywhere

**What gets re-queried unnecessarily**:
| Data | Changes | Currently queried |
|------|---------|-------------------|
| Company (id, timezone, is_active) | Rarely (monthly) | Every request |
| Holidays | Rarely (yearly setup) | Every check-in submit + dashboard |
| Team schedules | Occasionally | Every check-in status + submit |
| Person + team assignment | Occasionally | Multiple times per check-in flow |

---

### #3 — Dashboard Query Fan-Out

**Evidence in codebase**:
- `dashboard.service.ts:317` → Team lead dashboard: 3 parallel queries
- `dashboard.service.ts:493` → Supervisor dashboard: 3 parallel queries (+ team query before)
- `dashboard.service.ts:37` → Worker dashboard: 3 sequential queries (person → checkIns → holidays)
- Worker dashboard is **worst case**: sequential, not parallelized

**Query counts per dashboard endpoint**:
| Role | Queries | Pattern |
|------|---------|---------|
| Worker | 4 (sequential!) | person → checkIns → 2× holiday |
| Team Lead | 4 (1 sequential + 3 parallel) | team → [members, checkIns, holiday] |
| Supervisor | 4 (1 sequential + 3 parallel) | teams → [leaders, counts, checkIns] |
| Admin | 3 (parallel) | [teamCounts, roleCounts, unassigned] |

---

### #4 — Check-In Submit: Multiple Sequential DB Hits

**Evidence**: `check-in.service.ts:46–238`

Query chain for a single check-in submission:
1. `checkHolidayForDate()` → 1 query
2. `repository.getPersonWithTeam()` → 1 query (with join)
3. `prisma.$transaction()` → 3–5 queries inside:
   - `event.create()`
   - `checkIn.create()`
   - `missedCheckIn.findFirst()` (if late)
   - `missedCheckIn.update()` (if resolving)
   - `emitEvent()` (fire-and-forget, but still inside tx scope)

**Total: 5–7 queries per check-in submit**, most sequential.

---

## 3. Confirmation Tests (Do First)

### Test A: Add Response Time Header

**File**: `src/app.ts` — add as first middleware (before `secureHeaders`)

```typescript
// Temporary — remove after benchmarking
app.use('*', async (c, next) => {
  const start = performance.now();
  await next();
  const ms = (performance.now() - start).toFixed(0);
  c.header('X-Response-Time', `${ms}ms`);
  console.log(`${c.req.method} ${c.req.path} → ${ms}ms`);
});
```

### Test B: Measure Tenant Middleware Specifically

**File**: `src/middleware/tenant.ts` — add timing around the query

```typescript
const start = performance.now();
const company = await prisma.company.findUnique({ ... });
console.log(`[PERF] Tenant query: ${(performance.now() - start).toFixed(0)}ms`);
```

### Test C: Local PG vs Supabase

Run backend locally with:
1. `DATABASE_URL` pointing to Supabase → measure
2. `DATABASE_URL` pointing to local PostgreSQL → measure
3. Compare. If local is <100ms and Supabase is >500ms → network is the #1 issue.

### Test D: Direct URL vs Pooled URL

Temporarily use `DIRECT_URL` as `DATABASE_URL` (bypasses pgBouncer). If faster → Supavisor is adding overhead.

---

## 4. Execution Plan

### Phase A: Quick Wins (No Architecture Changes)

#### A1. In-Memory Company Cache

**File to modify**: `src/middleware/tenant.ts`

**What**: Cache company validation result in a `Map` with 5-minute TTL. Eliminates 1 DB query from every authenticated request.

```typescript
interface CachedCompany {
  is_active: boolean;
  timezone: string;
  expiresAt: number;
}

const companyCache = new Map<string, CachedCompany>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function tenantMiddleware(c: Context, next: Next): Promise<void> {
  const companyId = c.get('companyId') as string | undefined;
  if (!companyId) {
    throw new AppError('FORBIDDEN', 'Company context not found', 403);
  }

  // Check cache first
  const cached = companyCache.get(companyId);
  if (cached && cached.expiresAt > Date.now()) {
    if (!cached.is_active) {
      throw new AppError('FORBIDDEN', 'Company is inactive', 403);
    }
    c.set('companyTimezone', cached.timezone || DEFAULT_TIMEZONE);
    return next();
  }

  // Cache miss — query DB
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, is_active: true, timezone: true },
  });

  if (!company) {
    throw new AppError('FORBIDDEN', 'Company not found', 403);
  }

  // Store in cache
  companyCache.set(companyId, {
    is_active: company.is_active,
    timezone: company.timezone,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  if (!company.is_active) {
    throw new AppError('FORBIDDEN', 'Company is inactive', 403);
  }

  c.set('companyTimezone', company.timezone || DEFAULT_TIMEZONE);
  await next();
}

// Export for invalidation from admin module
export function invalidateCompanyCache(companyId: string): void {
  companyCache.delete(companyId);
}
```

**Risk**: Deactivated company stays active for up to 5 min.
**Mitigation**: Call `invalidateCompanyCache()` when admin deactivates a company.
**Expected Impact**: -100ms to -300ms per request.

---

#### A2. Region Alignment Check

**Action items** (no code change):
1. Log into Supabase dashboard → check project region
2. Check backend deployment region (Render/Railway/Vercel/VPS)
3. If different → migrate one to match the other
4. If Vercel serverless → set `VERCEL_REGION` in project settings

**Expected Impact**: -200ms to -1s per query roundtrip.
**Risk**: None.

---

#### A3. Connection Pool Tuning

**File to modify**: `.env` (or deployment env vars)

```
DATABASE_URL="postgresql://...?connection_limit=10&pool_timeout=10&connect_timeout=5&statement_cache_size=100"
```

| Param | Value | Why |
|-------|-------|-----|
| `connection_limit` | 10 | Prevents pool exhaustion on concurrent requests |
| `pool_timeout` | 10 | Fail fast instead of waiting 30s for a connection |
| `connect_timeout` | 5 | Detect dead connections early |
| `statement_cache_size` | 100 | Reuse prepared statements (reduces parse time) |

**Expected Impact**: -50ms to -200ms per request.
**Risk**: Low.

---

### Phase B: Query Optimization

#### B1. Parallelize Worker Dashboard

**File**: `src/modules/dashboard/dashboard.service.ts`, `getWorkerDashboard()`

**Current** (lines 45–110): Sequential — person query → checkIns query → holiday queries.

**Change**: Run person + checkIns + holiday queries in parallel.

```typescript
// Before (sequential):
const person = await prisma.person.findFirst({ ... });
const recentCheckIns = await prisma.checkIn.findMany({ ... });
const [holidayCheck, holidayDateSet] = await Promise.all([...]);

// After (parallel — person, checkIns, and holidays are independent):
const [person, recentCheckIns, [holidayCheck, holidayDateSet]] = await Promise.all([
  prisma.person.findFirst({ ... }),
  prisma.checkIn.findMany({ ... }),
  Promise.all([
    checkHolidayForDate(prisma, this.companyId, todayStr),
    buildHolidayDateSet(prisma, this.companyId, thirtyDaysAgo, today, timezone),
  ]),
]);
```

**Expected Impact**: -300ms to -800ms on worker dashboard (3 sequential → 1 parallel batch).
**Risk**: Low — queries are independent.

---

#### B2. Cache Holiday Data

**New file**: `src/shared/cache.ts`

**What**: Simple TTL cache utility reusable across the app.

```typescript
export class TtlCache<T> {
  private cache = new Map<string, { data: T; expiresAt: number }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    this.cache.set(key, { data, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }
}
```

**Then modify**: `src/shared/holiday.utils.ts`
- Cache `checkHolidayForDate()` results with key `${companyId}:${dateStr}`, TTL = 1 hour
- Holidays are set up annually, rarely change intra-day

**Expected Impact**: -100ms to -300ms per check-in submit and dashboard.
**Risk**: If admin adds a holiday mid-day, it won't take effect for up to 1 hour. Acceptable.

---

#### B3. Reduce Check-In Submit Query Count

**File**: `src/modules/check-in/check-in.service.ts`, `submit()`

**Current**: Holiday check (line 60) and person+team fetch (line 73) run sequentially.

**Change**: Run them in parallel.

```typescript
// Before:
const holidayCheck = await checkHolidayForDate(prisma, companyId, todayStr);
// ... throw if holiday ...
const person = await this.repository.getPersonWithTeam(personId);

// After:
const [holidayCheck, person] = await Promise.all([
  checkHolidayForDate(prisma, companyId, todayStr),
  this.repository.getPersonWithTeam(personId),
]);
if (holidayCheck.isHoliday) { throw ... }
```

**Expected Impact**: -100ms to -300ms on check-in submit.
**Risk**: Fetches person even on holidays (wasted query), but holidays are rare. Net positive.

---

#### B4. Add `select` Where Missing

**Files to audit**:
- `check-in.repository.ts` — `findAll()`, `findByPerson()` — check if full record is returned when only a few fields are needed
- `team.repository.ts` — `findAll()` — includes full team record
- `person.repository.ts` — `findAll()` — includes full person record
- `incident.repository.ts` / `case.repository.ts` — same pattern

**Rule**: Only `select` the fields actually used by the controller/frontend. This reduces:
- Network payload DB → App
- Serialization time
- Memory usage

**Expected Impact**: -20ms to -100ms per query.

---

### Phase C: Infrastructure (If Phase A+B Not Enough)

#### C1. Upstash Redis

**When**: If in-memory caching isn't sufficient (multi-instance deployment, cache survives restarts).

**What**: Replace `TtlCache` and `companyCache` with Redis-backed cache.

**Provider**: Upstash (serverless Redis, free tier = 10k commands/day).

**Estimated effort**: 1-2 days. Install `@upstash/redis`, create `src/config/redis.ts`, swap cache calls.

---

#### C2. Database Provider Migration

**When**: If confirmation tests (Section 3) show Supabase network latency is the dominant factor.

| Provider | Latency | Cost | Migration Effort |
|----------|---------|------|-----------------|
| Supabase (current) | High (shared + pooled) | Free–$25/mo | — |
| Neon | Medium (serverless PG) | Free–$19/mo | Low (change URL) |
| Railway Postgres | Low (dedicated) | ~$5/mo | Low (change URL) |
| VPS + PostgreSQL | Lowest | ~$5–10/mo | Medium (setup + maintain) |

**Migration steps**:
1. `pg_dump` from Supabase
2. `pg_restore` to new provider
3. Update `DATABASE_URL` and `DIRECT_URL`
4. Run `prisma migrate resolve` to sync migration state
5. Test all endpoints

---

## 5. Risks & Trade-offs

| Change | Risk | Mitigation |
|--------|------|-----------|
| Company cache (A1) | Deactivated company works for 5 min | `invalidateCompanyCache()` on admin action |
| Holiday cache (B2) | New holiday not immediate | 1-hour TTL is acceptable; add invalidation if needed |
| Region change (A2) | Brief downtime | Schedule maintenance window |
| Connection pool (A3) | Pool exhaustion under load | Monitor connection count |
| DB migration (C2) | Data transfer downtime | `pg_dump`/`pg_restore` during low traffic |

---

## 6. Execution Timeline

```
┌─ PHASE A: Quick Wins ──────────────────────────────────────────┐
│                                                                 │
│  Day 1: Confirmation tests (Section 3)                          │
│         → Identify actual bottleneck with real numbers           │
│         → Region alignment check (A2)                           │
│                                                                 │
│  Day 2: Implement company cache (A1)                            │
│         → Modify tenant.ts                                      │
│         → Add invalidation call in admin module                 │
│         → Tune connection pool params (A3)                      │
│                                                                 │
│  Checkpoint: Re-measure. If <1s → stop here.                   │
│                                                                 │
├─ PHASE B: Query Optimization ──────────────────────────────────┤
│                                                                 │
│  Day 3: Parallelize worker dashboard (B1)                       │
│         → Modify dashboard.service.ts                           │
│         → Parallelize check-in submit (B3)                      │
│         → Modify check-in.service.ts                            │
│                                                                 │
│  Day 4: Create TtlCache utility (B2)                            │
│         → Cache holiday lookups                                 │
│         → Audit & add select to repositories (B4)               │
│                                                                 │
│  Checkpoint: Re-measure. If <500ms → stop here.                │
│                                                                 │
├─ PHASE C: Infrastructure (only if needed) ─────────────────────┤
│                                                                 │
│  Day 5–7: Evaluate DB provider migration (C2)                   │
│           → Or add Upstash Redis (C1)                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Success Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Avg response time | ~3,000ms | <500ms | `X-Response-Time` header |
| P95 response time | Unknown | <800ms | Collect from logs |
| Queries per request (simple) | 3–4 | 1–2 | Prisma query log count |
| Queries per request (dashboard) | 4–8 | 2–4 | Prisma query log count |
| Tenant middleware | ~300ms | <5ms (cached) | Inline `performance.now()` |
| Check-in submit | ~1,500ms | <400ms | Endpoint timing |

---

## 8. What's Already Optimized (Don't Touch)

| Pattern | Where | Why It's Good |
|---------|-------|---------------|
| Singleton Prisma client | `config/database.ts` | Reuses connection pool |
| `Promise.all()` for parallel queries | 20+ instances across services | Reduces wall-clock time |
| 52 database indexes | `schema.prisma` | Multi-tenant + analytics optimized |
| Fire-and-forget audit logs | `shared/audit.ts` | Never blocks main flow |
| JWT auth without DB query | `middleware/auth.ts` | Pure in-memory crypto |
| Pagination max 100 | `shared/utils.ts` | Prevents unbounded queries |
| Date pre-computation | `shared/utils.ts` | Avoids per-record Luxon calls |
| `select` on dashboard queries | `dashboard.service.ts` | Already optimized (lines 47, 91, etc.) |
| `groupBy` consolidation | `dashboard.service.ts:588` | 3 queries instead of 6 |

---

## 9. Files That Will Be Modified

| File | Change | Phase |
|------|--------|-------|
| `src/app.ts` | Add response time middleware (temporary) | A (test) |
| `src/middleware/tenant.ts` | Add in-memory company cache | A1 |
| `.env` | Connection pool params | A3 |
| `src/modules/dashboard/dashboard.service.ts` | Parallelize worker dashboard | B1 |
| `src/shared/cache.ts` (new) | TtlCache utility class | B2 |
| `src/shared/holiday.utils.ts` | Cache holiday lookups | B2 |
| `src/modules/check-in/check-in.service.ts` | Parallelize holiday + person queries | B3 |
| Various `*.repository.ts` | Add `select` to queries | B4 |
