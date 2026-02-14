# 2026-02-12: Schedule-Aware Dashboard & QA Bug Fixes

## Context

QA code review of the check-in and missed check-in logic identified bugs in how the supervisor dashboard calculates compliance rates, and a minor bug in the person welcome message window check. The cross-midnight check-in window concern was investigated and confirmed as a non-issue (intentionally blocked at the validator level).

## Changes

### Fix 1: Supervisor Dashboard — Schedule-Aware Compliance (BUG)

**File:** `aegira-backend/src/modules/dashboard/dashboard.service.ts` — `getSupervisorDashboard()`

**Problem:** The supervisor dashboard used raw `workerCount` as the denominator for compliance rate and pending count calculations. This ignored:
- Workers whose effective schedule has today as a day off (worker override or team default)
- Company holidays
- Workers assigned today after the check-in window closed (not penalized)

This resulted in inflated "pending" counts and deflated compliance rates compared to the team lead dashboard, which correctly handled all these cases.

**Fix:** Replicated the team lead dashboard's per-worker classification pattern:
- Replaced `groupBy` worker count query with full worker `findMany` including schedule override fields (`work_days`, `check_in_start`, `check_in_end`, `team_assigned_at`)
- Added `checkHolidayForDate` to the parallel query block
- Added per-worker classification loop using `getEffectiveSchedule()`:
  - Holiday → `not_required`
  - Assigned today + window closed → `not_required`
  - Day off (worker override or team default) → `not_required`
- Changed calculations: `expectedCheckIns = workerCount - notRequiredCount`, `complianceRate = checkIns / expectedCheckIns`
- Added `totalExpected` and per-team `expectedCheckIns` to the response
- Added `isAssignedToday` helper function (same pattern as team lead dashboard)

**Frontend updates:**
- `aegira-frontend/src/types/check-in.types.ts` — Added `expectedCheckIns` to `TeamSummaryStats`, `totalExpected` to `SupervisorDashboardStats`
- `aegira-frontend/src/features/dashboard/pages/SupervisorDashboard.tsx` — Check-in display now shows `X/expectedCheckIns` instead of `X/workerCount`

### Fix 2: Person Welcome Message Window Check (BUG)

**File:** `aegira-backend/src/modules/person/person.controller.ts` — line 68

**Problem:**
```typescript
// Before: missing start-time check
const isWindowOpen = currentTime < checkInEnd;
// At 3 AM with 06:00-10:00 window → true (wrong, window hasn't opened)
```

**Fix:**
```typescript
const isWindowOpen = currentTime >= checkInStart && currentTime < checkInEnd;
```

### Cleanup: Remove Dead Code `isTimeWithinWindow`

**File:** `aegira-backend/src/shared/utils.ts`

**Problem:** `isTimeWithinWindow()` was exported but never imported or called anywhere in the entire backend codebase. It was kept for potential cross-midnight support, but cross-midnight windows are intentionally blocked at the validator level (`team.validator.ts` enforces `checkInEnd > checkInStart`).

**Fix:** Removed the unused function.

## Not a Bug: Cross-Midnight Check-In Windows

The QA review flagged that all time comparisons use simple string comparison (`currentTime >= checkInStart`) which would break for cross-midnight windows (e.g., 22:00→06:00). However, investigation confirmed this is **intentionally not supported**:

- `team.validator.ts` uses `isEndTimeAfterStart()` to reject cross-midnight windows
- Comment at top of validator: "Cross-midnight check-in windows are intentionally NOT supported"
- Documented in `docs/changelogs/2026-02-11-timezone-audit-and-cleanup.md` (Fix 3)

If cross-midnight support is needed in the future, all time comparisons across the codebase would need to be updated to use a cross-midnight-aware utility.

## Files Modified

| File | Change |
|------|--------|
| `aegira-backend/src/modules/dashboard/dashboard.service.ts` | Schedule-aware supervisor dashboard |
| `aegira-backend/src/modules/person/person.controller.ts` | Fix `isWindowOpen` check |
| `aegira-backend/src/shared/utils.ts` | Remove dead `isTimeWithinWindow` |
| `aegira-frontend/src/types/check-in.types.ts` | Add `expectedCheckIns`, `totalExpected` |
| `aegira-frontend/src/features/dashboard/pages/SupervisorDashboard.tsx` | Use `expectedCheckIns` in display |

## Verification

- Backend typecheck: 15 errors (all pre-existing, no new errors)
- Frontend typecheck: 0 errors (clean)
