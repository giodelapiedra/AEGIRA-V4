# 2026-02-11 — Timezone Audit & Cleanup

## Context

Full audit of timezone and scheduling logic across the backend, triggered by `docs/features/whs-dashboard/agent.md`. The goal was to verify that:

- Check-in schedule times follow the company timezone (not worker device/browser timezone)
- Schedule dates/times don't shift due to timezone conversion
- Workers in different countries follow the company timezone correctly

## Audit Result

**Overall: CORRECT** — The core timezone architecture is sound. Company timezone is the single source of truth, cached per-request via `tenantMiddleware`, and consistently used across check-in validation, missed check-in detection, analytics, and holiday checking.

3 minor issues were identified and fixed, plus 1 additional fix found during schedule modification audit.

---

## Changes

### Fix 1: Person Controller — Use Centralized Timezone Utilities

**File:** `aegira-backend/src/modules/person/person.controller.ts`

**Problem:** `notifyWorkerTeamAssignment()` used `Date.toLocaleTimeString()` and `Date.toLocaleDateString()` with a manual `dayMap` lookup instead of the centralized Luxon-based utilities used everywhere else.

**Before:**
```typescript
const now = new Date();
const currentTime = now.toLocaleTimeString('en-US', { timeZone: timezone, hour12: false, hour: '2-digit', minute: '2-digit' });
const currentDayOfWeek = now.toLocaleDateString('en-US', { timeZone: timezone, weekday: 'short' });
const dayMap: Record<string, string> = { 'Sun': '0', 'Mon': '1', 'Tue': '2', 'Wed': '3', 'Thu': '4', 'Fri': '5', 'Sat': '6' };
const currentDayNum = dayMap[currentDayOfWeek] || '1';
```

**After:**
```typescript
const currentTime = getCurrentTimeInTimezone(timezone);
const currentDayNum = getDayOfWeekInTimezone(timezone).toString();
```

**Why:** Consistency with the rest of the codebase. All other modules use `getCurrentTimeInTimezone()` and `getDayOfWeekInTimezone()` from `shared/utils.ts`. The old approach was functionally correct but used a different code path (`toLocaleTimeString` vs Luxon), which could diverge in edge cases (locale differences, DST handling).

---

### Fix 2: Scheduler Comments — Clarify Per-Company Timezone Processing

**File:** `aegira-backend/src/jobs/scheduler.ts`

**Problem:** Comments said "Asia/Manila" next to each cron job, which was misleading. The cron timezone only controls when the job fires — each job internally processes companies using their own `company.timezone`.

**Before:**
```typescript
/** Default timezone for cron schedules (Asia/Manila) */
const CRON_TIMEZONE = 'Asia/Manila';

// Missed check-in detection - every 15 minutes (Asia/Manila)
// Daily check-in reminder - 5:30 AM Asia/Manila
// Weekly cleanup - Sunday 2:00 AM Asia/Manila
```

**After:**
```typescript
/**
 * Cron trigger timezone (server time).
 * Note: This only controls WHEN cron fires. Each job processes
 * companies individually using their own company.timezone.
 */
const CRON_TIMEZONE = 'Asia/Manila';

// Missed check-in detection — fires every 15 min, processes each company in its own timezone
// Weekly cleanup — Sunday 2:00 AM server time
```

---

### Fix 3: Team Validator — Document Cross-Midnight Limitation

**File:** `aegira-backend/src/modules/team/team.validator.ts`

**Problem:** `isTimeWithinWindow()` in `shared/utils.ts` supports cross-midnight windows (e.g., 22:00→06:00), but the team validator rejects them with "end time must be after start time". This inconsistency was undocumented.

**Change:** Added a comment at the top of the file documenting that cross-midnight check-in windows are intentionally not supported.

---

### Fix 4: Team Service Analytics — Replace toLocaleTimeString with Luxon

**File:** `aegira-backend/src/modules/team/team.service.ts`

**Problem:** Same inconsistency as Fix 1 — `toLocaleTimeString()` was used in two places for submit time formatting instead of the centralized Luxon `toCompanyTimezone()` utility.

**Before:**
```typescript
const submitDate = new Date(checkIn.created_at);
const submitTimeStr = submitDate.toLocaleTimeString('en-US', {
  timeZone: timezone, hour12: false, hour: '2-digit', minute: '2-digit',
});
```

**After (trend submit time):**
```typescript
const submitDt = toCompanyTimezone(new Date(checkIn.created_at), timezone);
dailyStats[dateKey].submitMinutes.push(submitDt.hour * 60 + submitDt.minute);
```

**After (record submit time):**
```typescript
const submitDt = toCompanyTimezone(new Date(checkIn.created_at), timezone);
submitTime: submitDt.toFormat('HH:mm'),
```

**Also added:** A comment on the `expectedWorkers` calculation documenting that it uses the CURRENT schedule for historical dates. If a schedule is modified after a given date, compliance rates for those past dates may be slightly off. Accurate historical tracking would require storing schedule change events (future enhancement).

---

### Removal: Daily Reminder Job

**Files removed:**
- `aegira-backend/src/jobs/daily-reminder.ts` (deleted)

**Files modified:**
- `aegira-backend/src/jobs/scheduler.ts` — removed import and cron schedule for daily reminder
- `aegira-backend/CLAUDE.md` — removed `daily-reminder.ts` from directory tree

**Why:** The daily reminder was a stub (no actual implementation, just a log warning). It was decided that pre-check-in reminders are not needed. Removed to keep the codebase clean.

---

## Schedule Modification Logic Verification

Verified that when a schedule is modified (team or worker override), the system **immediately** uses the new schedule. No caching, no stale data.

| System | Behavior After Schedule Change |
|--------|-------------------------------|
| **Check-in submission** (`check-in.service.ts`) | Fresh DB query via `getPersonWithTeam()` → uses new schedule immediately |
| **Check-in status** (`check-in.service.ts`) | Fresh DB query → worker sees updated schedule immediately |
| **Missed check-in detector** (`missed-check-in-detector.ts`) | Fresh `prisma.person.findMany()` each run → uses new schedule on next 15-min cycle |
| **Analytics** (`team.service.ts`) | Uses current schedule for all dates (historical included) — documented limitation |

**Example scenario:** Admin changes team work days from Mon-Fri to Mon-Wed at 8:00 AM on Thursday.
- Worker tries to check in on Thursday → **REJECTED** ("not a work day") ✅
- Worker checks status on Thursday → **shows "not a work day"** ✅
- Missed check-in detector runs at 10:02 AM → **does NOT flag** Thursday workers ✅
- Analytics for past Thursdays → shows 0 expected (uses current schedule — documented limitation)

**Known limitation:** If the missed check-in detector already ran and created records BEFORE the schedule change, those records remain (historically accurate under the old schedule). This is by design — the snapshot captures the state at detection time.

---

## Files Changed Summary

| File | Action |
|------|--------|
| `aegira-backend/src/modules/person/person.controller.ts` | Refactored timezone code to use centralized Luxon utilities |
| `aegira-backend/src/modules/team/team.service.ts` | Replaced `toLocaleTimeString` with Luxon; documented analytics limitation |
| `aegira-backend/src/jobs/scheduler.ts` | Clarified comments, removed daily reminder cron |
| `aegira-backend/src/modules/team/team.validator.ts` | Added cross-midnight limitation comment |
| `aegira-backend/src/jobs/daily-reminder.ts` | Deleted |
| `aegira-backend/CLAUDE.md` | Removed daily-reminder from directory tree |
