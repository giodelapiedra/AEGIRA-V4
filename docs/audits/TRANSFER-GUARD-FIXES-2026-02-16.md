# Transfer Guard Fixes — Pending Transfer Protection

**Date:** 2026-02-16
**Scope:** Team transfer logic in `person.controller.ts`, `transfer-processor.ts`, Prisma schema
**Role:** Senior QA / Backend
**TypeScript Status:** 0 errors after fixes

---

## Problem Statement

When a worker has a pending team transfer (effective next day), the system allowed silent overwrites if the admin initiated another transfer before the first one executed. This caused:

1. **Silent overwrite** — second transfer overwrites `effective_team_id` with no trace of the first
2. **Missing audit trail** — `TEAM_TRANSFER_INITIATED` event with no matching `CANCELLED` or `COMPLETED`
3. **Confusion** — worker and team leads not notified that the first transfer was cancelled

Additionally, pending transfers were cleared silently (no event, no notification) during role changes, deactivation, and target team deactivation.

---

## Architecture Decision: Side Effects After DB Write

### Problem Found During Review

The initial implementation used a `clearPendingTransfer()` helper that fired events + notifications **inline** (before `repository.update()`). This caused an ordering bug:

```
1. clearPendingTransfer() fires event + notification  ← SIDE EFFECT DISPATCHED
2. Guard check throws AppError                        ← FUNCTION EXITS
3. repository.update() never runs                     ← DB UNCHANGED
Result: Event says "cancelled" but DB still has pending transfer (orphan event)
```

**Reachable scenario:** Worker on Team A, pending to B. Admin sends `{ role: 'ADMIN', teamId: 'C' }`. Role-change block fires cancel event, then `PENDING_TRANSFER_EXISTS` guard throws. Event dispatched, DB unchanged.

### Solution: Data-Only + Deferred Side Effects

Split the cancel operation into two phases:

1. **`markTransferCancelled(updateData)`** — sets null fields on `updateData` only (no side effects)
2. **`emitTransferCancellation()`** — fires event + notification, called AFTER `repository.update()` succeeds

```
1. markTransferCancelled(updateData)                  ← DATA ONLY
2. transferCancellation = { reason, ... }             ← COLLECT INFO
3. Guards can throw safely                            ← NO ORPHAN EVENTS
4. repository.update(id, updateData)                  ← DB WRITE
5. emitTransferCancellation(transferCancellation)     ← SIDE EFFECTS AFTER SUCCESS
```

This matches the pattern used by `cancelPendingTransfer` endpoint and `transfer-processor.ts`, where side effects fire AFTER the DB write.

---

## Changes Applied (3 files, 1 migration)

### Fix 1 — Pending Transfer Guard (P1)

**File:** `src/modules/person/person.controller.ts`
**Issue:** `updatePerson` allowed scheduling a new transfer when `effective_team_id` was already set, silently overwriting the pending transfer.
**Fix:** Added guard that throws `PENDING_TRANSFER_EXISTS` (409) if a pending transfer exists and no prior block (e.g., role change) already cancelled it. Admin must cancel first.

```typescript
// Guard: block new transfer if one is already pending (admin must cancel first)
// Skip if a prior block (role change) already cancelled the pending transfer
if (teamChanged && data.teamId && !isNewAssignment && existing.effective_team_id && !transferCancellation) {
  throw new AppError('PENDING_TRANSFER_EXISTS', '...Cancel it first...', 409);
}
```

**Frontend handling:** Error displayed as toast. Cancel button already exists in `AdminWorkerEditPage.tsx` via `useCancelTransfer` hook.

---

### Fix 2 — Same-Team Auto-Cancel (P2)

**File:** `src/modules/person/person.controller.ts`
**Issue:** If an API consumer sends `teamId === existing.team_id` while a pending transfer exists, the pending transfer was silently preserved.
**Fix:** Added auto-cancel that marks pending transfer fields for clearing and collects cancellation info for deferred event emission.

```typescript
if (data.teamId !== undefined && existing.effective_team_id) {
  markTransferCancelled(updateData);
  transferCancellation = { cancelledTransferTo: existing.effective_team_id, cancelledBy: userId, reason: 'same_team_reassignment' };
}
```

**Note:** Current frontend (`AdminWorkerEditPage.tsx` `buildUpdates()`) only sends `teamId` when it actually changed, so this path is not reachable from the UI. It exists as a safety net for direct API consumers. The UI uses the explicit cancel button instead.

---

### Fix 3 — Cancel Event on Explicit Cancel Endpoint (P2)

**File:** `src/modules/person/person.controller.ts`
**Endpoint:** `DELETE /persons/:id/pending-transfer`
**Issue:** `cancelPendingTransfer` sent notification and audit log but did NOT emit a `TEAM_TRANSFER_CANCELLED` event. Audit trail broken.
**Fix:** Added `emitEvent()` call AFTER `repository.cancelTransfer()` (correct ordering — DB write first).

---

### Fix 4 — Cancel Event on Role Change (P2)

**File:** `src/modules/person/person.controller.ts`
**Issue:** When role changed away from WORKER, pending transfer fields were cleared but no event or notification was emitted.
**Fix:** Uses `markTransferCancelled()` + deferred `emitTransferCancellation()` with `reason: 'role_change'`.

---

### Fix 5 — Cancel Event on Deactivation (P2)

**File:** `src/modules/person/person.controller.ts`
**Issue:** When worker was deactivated, pending transfer fields were cleared without event or notification.
**Fix:** Uses `markTransferCancelled()` + deferred `emitTransferCancellation()` with `reason: 'deactivation'`. Skips if a prior block (role change) already set `transferCancellation` to prevent duplicate events.

```typescript
// Skip if a prior block already handled it
if (data.isActive === false && existing.is_active && existing.effective_team_id && !transferCancellation) {
  markTransferCancelled(updateData);
  transferCancellation = { ..., reason: 'deactivation' };
}
```

---

### Fix 6 — Cancel Event in Transfer Processor (P2)

**File:** `src/jobs/transfer-processor.ts`
**Issue:** When the transfer processor cancelled a transfer due to the target team being inactive, no `TEAM_TRANSFER_CANCELLED` event was emitted.
**Fix:** Added `emitEvent()` call AFTER `personRepo.cancelTransfer()` (correct ordering — DB write first) with `reason: 'target_team_inactive'`.

---

### Fix 7 — Side-Effect Ordering Refactor (P1)

**File:** `src/modules/person/person.controller.ts`
**Issue:** Original `clearPendingTransfer()` helper fired events + notifications inline, before `repository.update()`. If a later guard threw, orphan events were dispatched.
**Fix:** Split into three parts:

| Function | Purpose | When Called |
|---|---|---|
| `markTransferCancelled(updateData)` | Sets effective fields to null (data-only) | During validation/data-building phase |
| `transferCancellation` variable | Collects reason + metadata for deferred emission | Set alongside `markTransferCancelled` |
| `emitTransferCancellation(...)` | Fires event + notification | AFTER `repository.update()` succeeds |

```typescript
// Phase 1: Data-only (before guards)
markTransferCancelled(updateData);
transferCancellation = { cancelledTransferTo: ..., reason: '...' };

// Phase 2: Guards can throw safely — no side effects dispatched yet

// Phase 3: DB write
const result = await repository.update(id, updateData);

// Phase 4: Side effects (only if DB write succeeded)
if (transferCancellation) {
  emitTransferCancellation(companyId, id, transferCancellation, timezone);
}
```

---

### Migration — `TEAM_TRANSFER_CANCELLED` EventType

**File:** `prisma/schema.prisma` (EventType enum)
**Migration:** `20260216120000_add_transfer_cancelled_event_type`
**SQL:** `ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'TEAM_TRANSFER_CANCELLED';`
**Status:** Applied to production DB, migration marked as applied.

---

## Event Audit Trail — Complete Transfer Lifecycle

Every pending transfer now has a complete event trail:

| Scenario | Events |
|---|---|
| Normal transfer | `INITIATED` → `COMPLETED` |
| Admin cancels | `INITIATED` → `CANCELLED` (reason: explicit cancel) |
| Same-team reassignment (API) | `INITIATED` → `CANCELLED` (reason: `same_team_reassignment`) |
| Role change from WORKER | `INITIATED` → `CANCELLED` (reason: `role_change`) |
| Worker deactivated | `INITIATED` → `CANCELLED` (reason: `deactivation`) |
| Target team deactivated | `INITIATED` → `CANCELLED` (reason: `target_team_inactive`) |

---

## Cancel Reason Reference

| `reason` value | Trigger | Source |
|---|---|---|
| (none — explicit cancel) | `DELETE /persons/:id/pending-transfer` | `cancelPendingTransfer()` |
| `same_team_reassignment` | API sends `teamId === current team_id` | `updatePerson()` |
| `role_change` | Role changed away from WORKER | `updatePerson()` |
| `deactivation` | Worker `is_active` set to `false` | `updatePerson()` |
| `target_team_inactive` | Target team deactivated before execution | `transfer-processor.ts` |

---

## Edge Cases Verified

| Scenario | Result |
|---|---|
| Transfer A→B then A→C (rapid) | Blocked: `PENDING_TRANSFER_EXISTS` (409) |
| Transfer A→B then save with A (frontend) | No `teamId` sent → pending preserved (use cancel button) |
| Transfer A→B then save with A (API) | Auto-cancel with `same_team_reassignment` reason |
| Role change + transfer in same request | Role-change cancels old transfer, guard skipped, new transfer scheduled |
| Role change + deactivation in same request | Only one cancel event (deactivation skips via `!transferCancellation`) |
| Guard throws after markTransferCancelled | No orphan events — side effects deferred to after DB write |
| Transfer processor — target team inactive | Cancel event emitted + notification sent (after DB write) |
| Cancel when no pending transfer | `NO_PENDING_TRANSFER` (400) |

---

## Known Pre-existing Behavior (Out of Scope)

**Non-WORKER roles can receive pending transfers via API.** The transfer logic (line 394-431) does not check role — it runs for any person with `teamChanged`. The frontend prevents this (team dropdown hidden for non-workers), but direct API consumers could trigger it. A future improvement would be to add a role guard: `if (effectiveRole !== 'WORKER') skip scheduled transfer logic`.

---

## Files Modified

| File | Changes |
|---|---|
| `src/modules/person/person.controller.ts` | +`PendingTransferCancellation` interface, +`markTransferCancelled()`, +`emitTransferCancellation()`, +pending guard, +same-team auto-cancel, +deferred cancel events on role change/deactivation, +event on explicit cancel |
| `src/jobs/transfer-processor.ts` | +cancel event when target team inactive |
| `prisma/schema.prisma` | +`TEAM_TRANSFER_CANCELLED` to `EventType` enum |
| `prisma/migrations/20260216120000_.../migration.sql` | ALTER TYPE migration |

**TypeScript:** 0 errors
**No new dependencies**
