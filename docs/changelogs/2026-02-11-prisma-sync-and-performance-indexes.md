# Prisma Client Sync & Performance Indexes

**Date:** 2026-02-11
**Type:** Bug Fix + Database Optimization
**Status:** COMPLETED
**Scope:** Missed Check-In Detection, Database Indexes

---

## Problem

The missed check-in detector (`aegira-backend/src/jobs/missed-check-in-detector.ts`) was completely broken. Every execution threw `PrismaClientValidationError`:

```
Unknown argument 'worker_role_at_miss'. Available options are marked with ?.
```

This caused ALL missed check-in detection to silently fail across every company. The job reported `totalDetected: 0` even when workers genuinely missed check-ins.

**Impact:** Critical — the core compliance feature (automated missed check-in detection with state snapshots) was non-functional. No missed check-in records were being created, no notifications were being sent, and team leaders had no visibility.

---

## Root Cause

The `schema.prisma` file had 15 state snapshot fields + 2 pattern indicator fields + 2 system state fields on the `MissedCheckIn` model. These columns **already existed in the database** (migration was applied previously), but the **Prisma Client was never regenerated** after the schema file was updated.

The Prisma Client's runtime type system did not know about the new fields, so any `createMany()` call that included them threw a validation error before reaching the database.

---

## Fix Applied

### 1. Prisma Client Regeneration

```bash
cd aegira-backend
npx prisma generate
```

This regenerated the Prisma Client to include all 15 snapshot fields, making `createMany()` accept `worker_role_at_miss` and all other state snapshot fields.

### 2. Performance Indexes Migration

Created migration `20260211120000_add_performance_indexes` and applied it:

```sql
-- CreateIndex
CREATE INDEX "check_ins_company_id_readiness_level_check_in_date_idx"
  ON "check_ins"("company_id", "readiness_level", "check_in_date");

-- CreateIndex
CREATE INDEX "events_company_id_person_id_created_at_idx"
  ON "events"("company_id", "person_id", "created_at");

-- CreateIndex
CREATE INDEX "holidays_company_id_is_recurring_idx"
  ON "holidays"("company_id", "is_recurring");

-- CreateIndex
CREATE INDEX "holidays_company_id_date_idx"
  ON "holidays"("company_id", "date");
```

These indexes were defined in `schema.prisma` but missing from the database. They optimize:
- Dashboard readiness level filtering (`check_ins`)
- Activity feed queries by person + date (`events`)
- Holiday lookup during missed check-in detection (`holidays`)

---

## Verification

1. **Migration status**: `npx prisma migrate status` = "Database schema is up to date"
2. **Schema drift**: `npx prisma migrate diff` = "This is an empty migration" (zero drift)
3. **Live database columns**: Queried `information_schema.columns` — all 29 columns confirmed present in `missed_check_ins` table
4. **Prisma Client validation**: Tested `createMany()` with all snapshot fields — passed field validation (only failed on expected FK constraint for test data)
5. **Field mapping chain**: Verified all 15 snapshot fields flow correctly through 4 layers:
   - Snapshot Service (`StateSnapshot` interface) -> Detector Job (spread into records) -> Repository (`CreateMissedCheckInData`) -> Database (snake_case columns)

---

## Files Changed

| File | Change |
|------|--------|
| `aegira-backend/node_modules/.prisma/client/*` | Regenerated Prisma Client |
| `aegira-backend/prisma/migrations/20260211120000_add_performance_indexes/migration.sql` | New migration (4 indexes) |

---

## Post-Fix Action Required

Restart the backend server to pick up the regenerated Prisma Client. The missed check-in detector will resume working on the next 15-minute cron cycle.
