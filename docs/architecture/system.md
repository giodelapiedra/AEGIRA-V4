# AEGIRA V5 — System Architecture & Prisma Review

> Last reviewed: 2026-02-17

## Overall Verdict

**Prisma is used correctly, securely, and with clear architectural discipline.** The codebase follows a strict repository pattern with multi-tenant isolation, avoids common anti-patterns, and keeps Prisma exclusively on the backend. No critical issues found.

---

## 1. Architecture Overview

```
Client (React SPA)
  │
  ▼
Hono API Server
  ├── Middleware: authMiddleware → tenantMiddleware
  ├── Controller (validation, response formatting)
  ├── Service (business logic, transactions)  ← optional
  ├── Repository (Prisma queries)             ← extends BaseRepository
  └── PrismaClient (singleton)
        │
        ▼
    PostgreSQL
```

**Request flow:**
1. `authMiddleware` extracts JWT → sets `companyId`, `personId`, `role`
2. `tenantMiddleware` validates company is active → sets `companyTimezone`
3. Controller validates input (Zod) → instantiates repository/service per-request
4. Repository applies `company_id` filtering via `BaseRepository.where()` / `withCompany()`
5. Response formatted as `{ success: true, data: T }` or paginated `{ items, pagination }`

---

## 2. Prisma Client Initialization

**File:** `aegira-backend/src/config/database.ts`

- **Singleton pattern** via `globalThis` — prevents multiple instances during dev hot-reload
- **Logging:** `['query', 'error', 'warn']` in development, `['error']` only in production
- **No middleware or extensions** (`$use`, `$extends` not used)
- **Connection pooling:** Prisma's built-in pool (default ~5 connections). Configured via `DATABASE_URL` query params (`?connection_limit=10&pool_timeout=10`)
- **`directUrl`** set in schema for migration safety (bypasses connection pooler)

---

## 3. Database Schema

**12 models, 11 enums, 52 indexes**

| Model | Purpose | Key constraints |
|-------|---------|-----------------|
| `Company` | Tenant root | `@@map("companies")` |
| `Person` | Users (all roles) | `@@unique([company_id, email])` |
| `Team` | Worker grouping | Schedule fields (`check_in_start/end` as `HH:mm` strings) |
| `CheckIn` | Daily readiness submission | `@@unique([person_id, check_in_date])` |
| `MissedCheckIn` | Detected misses + resolution | `@@unique([person_id, missed_date])`, FK to resolving CheckIn |
| `Event` | Event sourcing log | 19 event types, timezone-aware timestamps |
| `Notification` | In-app notifications | 7 notification types |
| `Holiday` | Per-company holidays | `@@unique([company_id, date])` |
| `Amendment` | Check-in amendment requests | Status workflow |
| `AuditLog` | Immutable action log | Fire-and-forget writes |
| `Incident` / `Case` | WHS incident management | Status workflows, auto-numbering |

**Schema design choices:**
- `check_in_start`/`check_in_end` stored as `String` (`"HH:mm"`) — avoids timezone conversion issues at the DB level
- `work_days` as CSV string (e.g., `"1,2,3,4,5"`) — simple, sufficient for current needs
- All tables use `@@map()` to plural snake_case table names
- Indexes are well-annotated with purpose comments (FK cascades, query pattern optimization)

---

## 4. Repository Pattern & Multi-Tenancy

### BaseRepository

**File:** `aegira-backend/src/shared/base.repository.ts`

```typescript
abstract class BaseRepository {
  constructor(
    protected readonly prisma: PrismaClient,
    protected readonly companyId: string
  ) {}

  protected where<T>(conditions: T): T & { company_id: string }
  protected withCompany<T>(data: T): T & { company_id: string }
}
```

**All 8 repositories** extend `BaseRepository`. Each is instantiated per-request with the authenticated user's `companyId`:

```typescript
const repo = new PersonRepository(prisma, c.get('companyId') as string);
```

### Three tenant isolation methods

| Method | Usage | Example |
|--------|-------|---------|
| `this.where()` | Read queries | `findFirst({ where: this.where({ id }) })` |
| `this.withCompany()` | Create operations | `create({ data: this.withCompany({ name }) })` |
| Explicit `company_id` | Updates/deletes | `update({ where: { id, company_id: this.companyId } })` |

### Repositories

| Repository | Key patterns |
|------------|-------------|
| `PersonRepository` | `SAFE_PERSON_SELECT` constant (excludes `password_hash`); catches `P2003`/`P2025` |
| `TeamRepository` | `findByIdSlim` (validation) vs `findById` (full); `_count` for member totals |
| `CheckInRepository` | `existsForDate` → `select: { id: true }` only; list queries use tight `select` |
| `IncidentRepository` | Separate `selectForList` / `selectWithRelations`; `groupBy` for status counts |
| `CaseRepository` | Same list/detail select pattern; `groupBy` for status distribution |
| `MissedCheckInRepository` | `createMany` + `skipDuplicates: true`; returns `Set<string>` for existence checks |
| `NotificationRepository` | `updateMany` for mark-as-read (avoids TOCTOU); `createMany` for batch sends |
| `AdminRepository` | `deleteMany` for multi-tenant-safe deletes; two-step verify-then-update |

---

## 5. Transactions

**7 interactive transactions** across the codebase — all use `prisma.$transaction(async (tx) => { ... })`, never the batch-array form.

| Location | What it does | Notes |
|----------|-------------|-------|
| `check-in.service.ts` | Create event → create check-in → resolve existing miss | Event emission for resolved miss happens **outside** tx to prevent orphan events |
| `incident.service.ts` (create) | Find next number → create incident → create event | Retry loop on `P2002` for `incident_number` uniqueness |
| `incident.service.ts` (approve) | Validate → update incident → create case → 2 events | Parallel `Promise.all` for event creates inside same tx |
| `incident.service.ts` (reject) | Validate → update incident → create event | Standard validate-update-log pattern |
| `case.service.ts` (update) | Read → validate status transition → update → create event | TOCTOU-safe: read inside transaction |
| `team.controller.ts` (deactivate) | Unassign members → cancel transfers → deactivate team | Three `updateMany` + one `update` |
| `auth.controller.ts` (password) | Update password hash → rotate JWT | Atomic password rotation |

---

## 6. Raw SQL Usage

**4 raw queries** — all in `aegira-backend/src/modules/dashboard/whs-analytics.service.ts`

| Query | Purpose |
|-------|---------|
| Q2a | Incident trend with timezone-aware date grouping (`AT TIME ZONE`) |
| Q2b | Team × severity breakdown (LEFT JOIN) |
| Q6 | Average response time (`EXTRACT(EPOCH FROM ...)`) |
| Q8 | Average resolution time |

**SQL injection risk: None.** All use Prisma's tagged template literal syntax (`prisma.$queryRaw\`...\``) which auto-parameterizes all interpolated values. `$queryRawUnsafe` and `$executeRaw` are **never used** anywhere.

These queries are justified — they use PostgreSQL `AT TIME ZONE` and `EXTRACT(EPOCH)` which Prisma's query builder cannot express.

---

## 7. Frontend: Prisma Isolation

**Prisma is strictly backend-only.** Zero imports of `@prisma/client` in `aegira-frontend/`.

Two frontend type files (`check-in.types.ts`, `team.types.ts`) contain `// Must match backend Prisma schema` comments — these are reference comments only, not actual Prisma dependencies. Frontend types are manually defined to match the API response shape.

---

## 8. Select/Include Patterns (Overfetching Analysis)

The codebase shows deliberate effort to minimize data transfer:

| Pattern | Where used | Impact |
|---------|-----------|--------|
| `SAFE_PERSON_SELECT` constant | All person queries | Never returns `password_hash` |
| Separate list/detail selects | Incident, Case repos | List queries are lean; detail queries include relations |
| `select: { id: true }` | Existence checks | Minimal data for boolean checks |
| `findByIdSlim` | Team validation guards | Only loads what's needed |
| `_count` over loading arrays | Team member counts | Avoids pulling full member list |
| `groupBy` over `findMany` | Analytics/dashboards | Aggregation at DB level |

**Minor note:** Some check-in queries use `include:` with nested `select:` (acceptable, slightly less explicit than pure `select:` trees). No actual overfetching observed.

---

## 9. Error Handling

Three-layer error handling for Prisma operations:

### Layer 1 — Repository (specific P-codes)

```typescript
catch (error) {
  if (error.code === 'P2003') → AppError('INVALID_TEAM', 400)
  if (error.code === 'P2025') → AppError('NOT_FOUND', 404)
}
```

### Layer 2 — Service (transaction-specific)

```typescript
catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
    → AppError('DUPLICATE_CHECK_IN', 409)
}
```

Incident service has a retry loop for `P2002` on auto-generated `incident_number`.

### Layer 3 — Global error handler (`app.ts`)

- `AppError` instances → structured JSON response with status code
- Unhandled errors (including unexpected Prisma errors) → logged with stack trace, returned as `500 INTERNAL_ERROR`
- Prisma errors never leak to the client

**Handled Prisma error codes:** `P2002` (unique constraint), `P2003` (FK constraint), `P2025` (record not found).

---

## 10. Findings & Recommendations

### What's done well

1. **Multi-tenancy isolation** — `BaseRepository` guarantees `company_id` scoping on every query. No bypass paths found.
2. **No overfetching** — Deliberate `select`/`include` usage throughout. `SAFE_PERSON_SELECT` prevents password leakage.
3. **Transaction discipline** — Interactive transactions for all multi-step mutations. Event emissions outside transactions where appropriate.
4. **Zero SQL injection surface** — Tagged template literals on all raw queries. No unsafe methods.
5. **Clean separation** — Prisma is exclusively in the backend. Frontend uses its own type definitions.
6. **Error handling** — Three layers: repo → service → global. Prisma errors never leak to clients.

### Minor improvements to consider

| # | Area | Observation | Severity | Recommendation |
|---|------|------------|----------|----------------|
| 1 | Admin repo | `updatePersonRole` uses two-step find-then-update instead of `update({ where: { id, company_id } })` | Low | Use compound where for consistency (currently safe due to prior findFirst check) |
| 2 | Connection pool | No explicit pool configuration in code | Low | Document recommended `DATABASE_URL` params for production (`connection_limit`, `pool_timeout`) |
| 3 | Cron jobs | Missed check-in detector processes companies sequentially | Info | Current approach is correct — controls pool pressure. Consider parallel with concurrency limit if scaling beyond ~50 companies |
| 4 | Schema | `work_days` as CSV string | Info | Works fine at current scale. Consider `Int[]` array if needing DB-level day filtering |

### No issues found in

- Frontend Prisma isolation
- SQL injection / raw query safety
- Transaction boundary correctness
- Select/include discipline
- Multi-tenant query scoping
- Prisma client lifecycle management
