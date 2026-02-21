# Daily Check-In Feature — Testing Audit

> **Date**: 2026-02-21
> **Module**: `aegira-backend/src/modules/check-in/`, `missed-check-in/`, `jobs/missed-check-in-detector.ts`
> **Scope**: Edge cases, test strategy, race conditions, data consistency

## BUGS FOUND & FIXED

### BUG-A (P2) — Time drift across midnight in `submit()` — FIXED
**File**: `check-in.service.ts`
**Problem**: `submit()` called `DateTime.now()` 3 separate times across an async gap:
1. Line 52: `getTodayInTimezone()` → captures "Monday 2026-02-23"
2. Lines 61-64: `Promise.all([checkHolidayForDate, getPersonWithTeam])` → **10-500ms async gap**
3. Line 127: `getDayOfWeekInTimezone()` → if midnight crossed, returns **Tuesday (2)**
4. Line 141: `getCurrentTimeInTimezone()` → returns "00:00" (Tuesday)

**Impact**: Worker submitting at 23:59 Monday. After the async gap, day-of-week returns Tuesday. If Tuesday is not in their `work_days`, they get `NOT_WORK_DAY` error. If it is, `currentTime = "00:00"` is before window → `OUTSIDE_CHECK_IN_WINDOW`. Either way, valid Monday check-in rejected.

**Fix**: Capture a single `DateTime.now().setZone(tz)` snapshot at method start, derive `todayStr`, `dayOfWeek`, and `currentTime` from it. Same fix applied to `getCheckInStatus()`.

### BUG-B (P3) — Late detection reads clock independently — FIXED
**File**: `event.service.ts` + `check-in.service.ts`
**Problem**: `buildEventData()` called `DateTime.now()` again (4th read) to determine `is_late`. In an edge case where the service decides "within window" at T1 but `buildEventData` reads T2 (past window), the event is marked `is_late: true` while the service treated it as on-time.

**Fix**: Added `capturedTimeHHmm` field to `CreateEventInput`. The check-in service passes its snapshot time so `buildEventData` uses the same value for late detection.

### BUG-C (P3) — Holiday cache not truly bounded — NOT FIXED (documented)
**File**: `holiday.utils.ts`
**Problem**: Cache eviction (line 42-47) only removes expired entries. If all 5000 entries are fresh, the cache grows unbounded. The "bounded to 5000" comment is misleading.
**Risk**: Low — entries expire in 1 hour, so in practice the cache stays near 5000. Would only grow if 5000+ company+date combos are checked within a single hour.

### LOGIC GAP (P3) — Missed check-in detector excludes TEAM_LEAD — NOT FIXED (needs clarification)
**File**: `missed-check-in-detector.ts` line 145
**Problem**: Cron filters `role: 'WORKER'`, but check-in routes allow `['WORKER', 'TEAM_LEAD']`. Team leads who miss their check-in are never detected or notified.
**Question**: Is this by design (team leads aren't required)? If so, document it. If not, add `'TEAM_LEAD'` to the cron filter.

---

---

## 1. Edge Cases

### 1.1 Time Zones

| # | Edge Case | Current Handling | Risk |
|---|-----------|-----------------|------|
| TZ-1 | Worker's company is in UTC+13 (e.g., Pacific/Tongatapu) — "tomorrow" is already today there | `getTodayInTimezone()` uses `DateTime.now().setZone(tz)` — correctly resolves per-company date | LOW |
| TZ-2 | Company timezone is negative offset (e.g., US/Hawaii UTC-10) — "yesterday" is still today there | Same — Luxon handles negative offsets correctly | LOW |
| TZ-3 | Two companies: one in Asia/Manila (UTC+8), one in America/New_York (UTC-5). Same UTC instant yields different calendar dates | Each company processes independently with its own timezone parameter. `processCompany()` calls `getTodayInTimezone(timezone)` per-company | LOW |
| TZ-4 | Invalid or unrecognized timezone string stored in Company table | Luxon `setZone()` returns an invalid DateTime → `.toFormat()` returns `"Invalid DateTime"`. **No runtime guard exists.** | MEDIUM — should validate timezone on company create/update |
| TZ-5 | `parseDateInTimezone("2026-02-21", "Asia/Manila")` — ensures UTC midnight storage | Explicitly constructs `new Date(Date.UTC(year, month-1, day))` — correct | LOW |
| TZ-6 | Time comparison uses string `"HH:mm"` — "09:59" < "10:00" works because zero-padded | `TIME_REGEX` enforces `[01][0-9]|2[0-3]` — always 2-digit hours | LOW |

### 1.2 Day Boundaries

| # | Edge Case | Current Handling | Risk |
|---|-----------|-----------------|------|
| DB-1 | Worker submits check-in at 23:59 company time — must count as today | `getTodayInTimezone()` returns today's date at that moment. Check-in stored with that date | LOW |
| DB-2 | Worker submits at 00:01 company time — must count as new day, not yesterday | Same — `getTodayInTimezone()` returns the new day's date | LOW |
| DB-3 | Server in UTC, company in UTC+13 — at server 11:00 UTC it's already "tomorrow" in Tonga | `DateTime.now().setZone(tz)` is server-clock-independent for date resolution | LOW |
| DB-4 | Check-in date stored as `@db.Date` (date-only) — no time component in DB | `parseDateInTimezone()` returns UTC midnight. Prisma `@db.Date` strips time. Correct | LOW |
| DB-5 | Cron runs at 23:55, worker submits at 00:01 next day — cron sees "today" as old day, worker sees new day | Each uses `getTodayInTimezone()` at runtime — naturally correct since they run at different times | LOW |
| DB-6 | **Cross-midnight check-in window** (e.g., start 22:00, end 02:00) | **Intentionally NOT supported.** `isEndTimeAfterStart()` returns false → falls back to team window. Validator enforces `checkInEnd > checkInStart` | LOW (documented design decision) |

### 1.3 DST Changes

| # | Edge Case | Current Handling | Risk |
|---|-----------|-----------------|------|
| DST-1 | Spring forward: clock jumps from 01:59 → 03:00. Check-in window 01:00-02:30 — the 02:00-02:59 hour doesn't exist | Luxon resolves non-existent times by shifting forward. `getCurrentTimeInTimezone()` returns "03:00" — worker appears to be past the window, **is allowed (late submission)** | LOW |
| DST-2 | Fall back: clock goes from 01:59 → 01:00 (repeated hour). Window 01:00-02:00 — "01:30" occurs twice | Luxon defaults to the first occurrence. Worker gets the first "01:30" — check-in allowed. Second "01:30" also allowed (still within window) | LOW |
| DST-3 | DST change at midnight — date boundary shifts | `getTodayInTimezone()` uses `DateTime.now().setZone(tz)` which handles DST transitions. The calendar date is always correct | LOW |
| DST-4 | `lateByMinutes` calculation during DST spring-forward | Uses string-based HH:mm arithmetic (`endMinutes - curMinutes`), not real elapsed time. If window ends at 02:00 and clock jumps to 03:00, `lateByMinutes = 60` even though only 1 second passed | MEDIUM — acceptable for analytics, but documented |
| DST-5 | `Asia/Manila` has no DST currently | Default timezone has no DST, but system supports other timezones that do | N/A |

### 1.4 Deactivation Status

| # | Edge Case | Current Handling | Risk |
|---|-----------|-----------------|------|
| DA-1 | Deactivated worker tries to check in | `getPersonWithTeam()` filters `is_active: true` → returns null → `ACCOUNT_INACTIVE` error (403) | LOW |
| DA-2 | Worker deactivated mid-day after already checking in | Check-in record persists (read-only). Future check-ins blocked | LOW |
| DA-3 | Worker deactivated mid-day, cron runs later | Cron filters `is_active: true` — deactivated worker excluded from missed detection | LOW |
| DA-4 | Team deactivated — worker tries to check in | Service guards `!person.team.is_active` → `TEAM_INACTIVE` error (400) | LOW |
| DA-5 | Team deactivated — cron runs | Cron fetches only active teams (`is_active: true`), then filters workers by `team_id: { in: activeTeamIds }` | LOW |
| DA-6 | Company deactivated | Tenant middleware blocks all requests → 403. Cron fetches only active companies | LOW |
| DA-7 | Worker deactivated between check-in submission start and transaction commit | Transaction reads from `getPersonWithTeam()` before starting. If deactivated after that read but before INSERT, the INSERT succeeds (no `is_active` FK constraint on CheckIn) | LOW — acceptable race window, check-in is valid at moment of request |

### 1.5 Re-activation Scenarios

| # | Edge Case | Current Handling | Risk |
|---|-----------|-----------------|------|
| RA-1 | Worker re-activated same day — can they check in? | Yes — `getPersonWithTeam()` returns the person if `is_active: true`. No "reactivated today" guard | LOW |
| RA-2 | Worker re-activated — missed check-ins during inactive period | No backfill. Missed check-ins are only detected by the cron job when it runs. Past inactive days produce no records | LOW |
| RA-3 | Team re-activated — workers can check in again | Same — team becomes active, workers pass `is_active` check on team | LOW |
| RA-4 | Worker re-activated and assigned to new team same day — cron excludes (same-day assignment) | Correct — `assignedDateStr >= todayStr` filters out same-day assignments | LOW |
| RA-5 | Worker re-activated but `team_assigned_at` is old (from before deactivation) | Cron will include them if `team_assigned_at < today` and window has closed. This is correct — they were assigned before and should have checked in | LOW |

---

## 2. Test Cases

### 2.1 Unit Tests

#### A. Timezone Utilities (`shared/utils.ts`)

| Test ID | Description | Input | Expected |
|---------|-------------|-------|----------|
| UTC-01 | `getTodayInTimezone` returns correct date for positive offset | tz="Asia/Manila" when UTC is 2026-02-20T20:00Z (Feb 21 in Manila) | "2026-02-21" |
| UTC-02 | `getTodayInTimezone` returns correct date for negative offset | tz="America/New_York" when UTC is 2026-02-21T03:00Z (Feb 20 in NY) | "2026-02-20" |
| UTC-03 | `getCurrentTimeInTimezone` returns zero-padded HH:mm | tz="Asia/Manila" when UTC is 2026-02-21T00:30Z | "08:30" |
| UTC-04 | `getDayOfWeekInTimezone` Sunday → 0 | A known Sunday date | 0 |
| UTC-05 | `getDayOfWeekInTimezone` Monday → 1 | A known Monday date | 1 |
| UTC-06 | `getDayOfWeekInTimezone` Saturday → 6 | A known Saturday date | 6 |
| UTC-07 | `parseDateInTimezone` stores UTC midnight | "2026-02-21", "Asia/Manila" | `Date(2026-02-21T00:00:00.000Z)` |
| UTC-08 | `formatDateInTimezone` converts UTC to timezone date | `Date(2026-02-21T20:00Z)`, "Asia/Manila" | "2026-02-22" (Feb 22 in Manila) |
| UTC-09 | `formatTime12h` converts 24h to 12h | "06:00", "18:00", "00:00", "12:00", "23:59" | "6:00 AM", "6:00 PM", "12:00 AM", "12:00 PM", "11:59 PM" |
| UTC-10 | `calculateAge` near birthday boundary | DOB=Feb 21 2000, tz where it's still Feb 20 | age=25 (not yet birthday) |
| UTC-11 | `daysBetweenDateStrings` same date | "2026-02-21", "2026-02-21" | 0 |
| UTC-12 | `daysBetweenDateStrings` adjacent dates | "2026-02-20", "2026-02-21" | 1 |

#### B. Schedule Utilities (`shared/schedule.utils.ts`)

| Test ID | Description | Input | Expected |
|---------|-------------|-------|----------|
| SCH-01 | Worker with full schedule override | person: {work_days:"1,3,5", start:"07:00", end:"09:00"}, team defaults | Uses worker's schedule |
| SCH-02 | Worker without override — uses team defaults | person: all null, team: "1,2,3,4,5", "06:00"-"10:00" | Team schedule |
| SCH-03 | Partial override — only work_days | person: {work_days:"1,3,5"}, team times | Worker days + team times |
| SCH-04 | Inverted window (start >= end) — falls back to team | person: {start:"10:00", end:"06:00"} | Team's window used |
| SCH-05 | `isEndTimeAfterStart` normal range | "06:00", "10:00" | true |
| SCH-06 | `isEndTimeAfterStart` equal times | "10:00", "10:00" | false |
| SCH-07 | `isEndTimeAfterStart` inverted | "10:00", "06:00" | false |
| SCH-08 | `isWorkDay` Monday is work day | day="1", person null, team "1,2,3,4,5" | true |
| SCH-09 | `isWorkDay` Saturday not work day | day="6", person null, team "1,2,3,4,5" | false |
| SCH-10 | `isWorkDay` worker override includes Saturday | day="6", person "1,2,3,4,5,6", team "1,2,3,4,5" | true |

#### C. Readiness Calculation (`check-in.service.ts`)

| Test ID | Description | Input | Expected |
|---------|-------------|-------|----------|
| RDY-01 | Optimal worker — high readiness | sleep 8h, quality 9, stress 2, physical 9, no pain | GREEN (>=70) |
| RDY-02 | Poor worker — low readiness | sleep 3h, quality 2, stress 9, physical 2, pain 8 | RED (<50) |
| RDY-03 | Mid-range worker | sleep 6h, quality 5, stress 5, physical 5, no pain | YELLOW (50-69) |
| RDY-04 | Pain changes weight formula | Same inputs with/without pain | Different scores |
| RDY-05 | painLevel=0 treated as "no pain" | painLevel=0 | painScore=null, no-pain weights used |
| RDY-06 | Sleep score bands | hours: 3, 5, 6, 7, 8, 10 | 40, 60, 80, 100, 100, 90 (combined with quality) |
| RDY-07 | Stress is inverse | stressLevel=1 → 90, stressLevel=10 → 0 | Correct inversion |
| RDY-08 | Physical score is linear | physicalCondition=1 → 10, physicalCondition=10 → 100 | 10x multiplier |

#### D. Late Detection (`event.service.ts`)

| Test ID | Description | Input | Expected |
|---------|-------------|-------|----------|
| LTE-01 | On-time submission | current="09:30", window end="10:00" | isLate=false |
| LTE-02 | Exactly at window close | current="10:00", window end="10:00" | isLate=false |
| LTE-03 | 1 minute late | current="10:01", window end="10:00" | isLate=true, lateByMinutes=1 |
| LTE-04 | Hours late | current="14:30", window end="10:00" | isLate=true, lateByMinutes=270 |
| LTE-05 | No schedule window | current="10:00", window=undefined | isLate=false |
| LTE-06 | Before window opens | current="05:00", window end="10:00" | isLate=false |

#### E. Holiday Utilities (`shared/holiday.utils.ts`)

| Test ID | Description | Input | Expected |
|---------|-------------|-------|----------|
| HOL-01 | Exact date holiday match | Today is Christmas 2026 (Dec 25, non-recurring) | isHoliday=true |
| HOL-02 | Recurring holiday match | Any year, Dec 25 marked recurring | isHoliday=true |
| HOL-03 | No holiday match | Normal work day | isHoliday=false |
| HOL-04 | Cache hit returns same result | Call twice with same inputs | Second call uses cache |
| HOL-05 | Cache eviction when exceeding max entries | Fill cache to 5000, add one more | Expired entries evicted |
| HOL-06 | `invalidateHolidayCache` clears company entries | Cache has entries for company A and B, invalidate A | Only A's entries removed |
| HOL-07 | `buildHolidayDateSet` returns correct set for range | Range includes 2 holidays | Set has 2 date strings |

### 2.2 Integration Test Cases

| Test ID | Description | Expected |
|---------|-------------|----------|
| INT-01 | Complete check-in submission flow (happy path) | 201 Created, readiness scores calculated, event created |
| INT-02 | Duplicate check-in on same day | 409 DUPLICATE_CHECK_IN |
| INT-03 | Check-in on holiday | 400 HOLIDAY |
| INT-04 | Check-in by deactivated worker | 403 ACCOUNT_INACTIVE |
| INT-05 | Check-in with inactive team | 400 TEAM_INACTIVE |
| INT-06 | Check-in on non-work day | 400 NOT_WORK_DAY |
| INT-07 | Check-in before window opens | 400 OUTSIDE_CHECK_IN_WINDOW |
| INT-08 | Late check-in — resolves existing missed record | 201 Created, MissedCheckIn.resolved_at set |
| INT-09 | Late check-in before cron — upsert creates+resolves | 201 Created, MissedCheckIn created with resolved_at |
| INT-10 | Missed check-in detection — full flow | MissedCheckIn records created, notifications sent |
| INT-11 | Cron skips holiday | No records created |
| INT-12 | Cron excludes same-day assigned worker | Worker not in results |
| INT-13 | Cron re-run is idempotent | `skipDuplicates` prevents double records |
| INT-14 | Multi-company isolation | Company A's check-ins invisible to Company B |

### 2.3 Boundary Conditions

| Test ID | Description | Boundary |
|---------|-------------|----------|
| BND-01 | `hoursSlept = 0` | Minimum valid, sleep score uses <5 band |
| BND-02 | `hoursSlept = 15` | Maximum valid per Zod schema |
| BND-03 | `stressLevel = 1` (minimum) | Stress score = 90 |
| BND-04 | `stressLevel = 10` (maximum) | Stress score = 0 |
| BND-05 | `painLevel = 0` | Treated as "no pain" — null painScore |
| BND-06 | `painLevel = 10` (max pain) | Pain score = 0 |
| BND-07 | Check-in at exactly window start | `currentTime >= checkInStart` — allowed |
| BND-08 | Check-in 1 min before window start | `currentTime < checkInStart` — rejected |
| BND-09 | Check-in at exactly window end | `currentTime <= checkInEnd` — allowed, not late |
| BND-10 | Check-in 1 min after window end | Late, but allowed |
| BND-11 | Worker with `work_days = "0,1,2,3,4,5,6"` | Every day is a work day |
| BND-12 | Worker with `work_days = "0"` (Sunday only) | Only Sunday is work day |
| BND-13 | Cron buffer: check at exactly `checkInEnd + 2min` | `currentTime >= endWithBuffer` — eligible |
| BND-14 | Cron buffer: check at `checkInEnd + 1min` | Not yet eligible (buffer not met) |

---

## 3. Race Conditions, Time-Based Bugs, Data Consistency Risks

### 3.1 Race Conditions

| # | Race Condition | Mitigation | Residual Risk |
|---|---------------|------------|---------------|
| RC-1 | **Duplicate check-in**: Two concurrent POST requests for same worker on same day | DB unique constraint `@@unique([person_id, check_in_date])` + Prisma `P2002` catch → 409 | NONE — DB-level enforcement |
| RC-2 | **Late check-in vs cron**: Worker submits late while cron is inserting MissedCheckIn | 3-layer defense: (1) `findFirst` for existing record, (2) `upsert` with unique constraint, (3) `skipDuplicates` in cron | NONE — all scenarios handled |
| RC-3 | **Cron overlapping runs**: Two cron invocations at same time | In-memory `isRunning` lock in `detectMissedCheckIns()` | MEDIUM — single-instance only. Multi-instance deployments need Redis/DB lock |
| RC-4 | **Deactivation during check-in**: Worker deactivated between `getPersonWithTeam()` and transaction commit | No FK constraint on `is_active` — check-in will succeed. Acceptable: worker was active at request time | LOW |
| RC-5 | **Transfer during check-in**: Worker transferred between schedule validation and INSERT | Worker validates against current team (by design). Transfer processor runs every 15 min — brief race window | LOW — documented design decision |
| RC-6 | **Holiday added during check-in**: Admin adds holiday between `checkHolidayForDate()` and INSERT | Check-in will succeed (holiday wasn't active at validation time). Cached for 1 hour | LOW — holiday additions are rare |

### 3.2 Time-Based Bugs

| # | Bug | Status | Notes |
|---|-----|--------|-------|
| TB-1 | **DST lateByMinutes inaccuracy**: String-based `HH:mm` arithmetic doesn't account for DST gap/overlap | KNOWN — acceptable for analytics use only, not billing | MEDIUM |
| TB-2 | **Server clock drift**: If server NTP is off, `DateTime.now()` returns wrong time | Not mitigated — relies on infrastructure-level NTP. All time decisions use server clock | LOW if infrastructure is sound |
| TB-3 | **parseDateInTimezone month-off-by-one**: `new Date(Date.UTC(year, month-1, day))` — `month-1` is intentional (JS Date months are 0-indexed) | CORRECT — properly handled | NONE |
| TB-4 | **formatTime12h midnight edge case**: `h=0` → `hours12=12` (12:00 AM). `h=12` → `hours12=12` (12:00 PM) | CORRECT — both handled | NONE |
| TB-5 | **day-of-week Luxon conversion**: Luxon uses 1=Mon..7=Sun, system needs 0=Sun..6=Sat | `dt.weekday === 7 ? 0 : dt.weekday` — CORRECT | NONE |

### 3.3 Data Consistency Risks

| # | Risk | Mitigation | Residual Risk |
|---|------|------------|---------------|
| DC-1 | **Orphan events on rollback**: Event created inside transaction, then transaction rolls back | Event and CheckIn are in the same `$transaction` — both roll back together. `emitEvent()` for resolution is outside transaction (fire-and-forget) | NONE |
| DC-2 | **MissedCheckIn snapshot immutability**: Snapshot fields captured at detection time, never updated if team leader changes | By design — snapshot represents state at moment of miss | NONE |
| DC-3 | **Holiday cache staleness**: Cache TTL is 1 hour — newly added holiday might not be respected for up to 1 hour | `invalidateHolidayCache(companyId)` is called after admin CRUD on holidays. Only stale if admin uses direct DB edits | LOW |
| DC-4 | **Company timezone cache in tenant middleware**: 5-min TTL — timezone change not reflected immediately | Timezone changes are extremely rare. 5-min delay is acceptable | LOW |
| DC-5 | **Event `entity_id` not set during check-in creation**: Event is created before CheckIn, so `entity_id` is not available | Event captures all check-in data in `payload` field. `entity_id` is null for CHECK_IN_SUBMITTED events | LOW — can be backfilled if needed |
| DC-6 | **MissedCheckIn resolution without snapshot**: Late check-in before cron runs creates MissedCheckIn via upsert without state snapshot fields | Pre-cron miss records have null snapshot fields. Dashboard/analytics must handle null snapshots | MEDIUM — snapshot data is missing for pre-cron resolutions |

---

## 4. Testing Strategy

### 4.1 Test Pyramid

```
                    ┌─────────┐
                    │  E2E    │  ← 3-5 critical paths (API → DB → Response)
                   ─┤  Tests  ├─
                  / └─────────┘ \
                 /                \
              ┌────────────────────┐
              │ Integration Tests  │  ← 15-20 tests (service + DB mocks)
             ─┤  (Service Layer)   ├─
            / └────────────────────┘ \
           /                          \
        ┌──────────────────────────────┐
        │       Unit Tests             │  ← 60+ tests (pure functions)
        │  utils, schedule, readiness  │
        │  late detection, holiday     │
        └──────────────────────────────┘
```

### 4.2 Test File Structure

```
aegira-backend/tests/unit/
├── helpers/
│   ├── mock-prisma.ts        ← Prisma mock factory
│   └── date-fixtures.ts      ← Fixed dates for deterministic tests
├── shared/
│   ├── utils.test.ts         ← Timezone & date utility tests
│   ├── schedule-utils.test.ts ← Schedule resolution tests
│   └── holiday-utils.test.ts  ← Holiday checking + cache tests
├── check-in/
│   ├── readiness.test.ts     ← Readiness calculation tests
│   ├── check-in-service.test.ts ← Submission logic tests (mocked DB)
│   └── check-in-status.test.ts  ← Status endpoint logic tests
├── event/
│   └── late-detection.test.ts ← Late submission detection tests
└── jobs/
    └── missed-check-in-detector.test.ts ← Cron job logic tests
```

### 4.3 Test Implementation Approach

**Pure Function Tests** (no mocking required):
- `getTodayInTimezone`, `getCurrentTimeInTimezone`, `getDayOfWeekInTimezone` → mock `DateTime.now()` via Luxon's `Settings.now`
- `parseDateInTimezone`, `formatDateInTimezone`, `formatTime12h`, `calculateAge` → deterministic inputs
- `getEffectiveSchedule`, `isWorkDay`, `isEndTimeAfterStart` → deterministic inputs
- `calculateReadiness`, `calculateSleepScore`, `getReadinessLevel` → deterministic inputs
- `detectLateSubmission` → deterministic inputs
- `addMinutesToTime` → deterministic inputs

**Service Tests** (Prisma mocked):
- Mock `prisma.$transaction`, `prisma.checkIn.create`, `prisma.event.create`
- Mock `checkHolidayForDate`, `getPersonWithTeam`
- Test the orchestration logic, error paths, and event emission

**Cron Job Tests** (full mock):
- Mock all Prisma queries (`company.findMany`, `team.findMany`, `person.findMany`, etc.)
- Mock `DateTime.now()` for deterministic time
- Test eligibility filtering, duplicate avoidance, notification grouping

### 4.4 Tools & Configuration

- **Framework**: Vitest (already configured)
- **Mocking**: `vi.mock()` for module mocks, `vi.fn()` for function stubs
- **Time Control**: Luxon `Settings.now` for freezing time
- **DB Mocking**: Custom mock factories (no real DB connection in unit tests)
- **Coverage Target**: 80%+ line coverage on check-in service, 90%+ on pure utilities

### 4.5 Priority Order

1. **P0 — Pure utility tests** (timezone, schedule, readiness, late detection) — highest ROI, zero setup
2. **P1 — Check-in service submission tests** (guards, happy path, error paths) — core business logic
3. **P1 — Missed check-in detector tests** (eligibility, idempotency) — cron correctness
4. **P2 — Holiday utility tests** (cache behavior, recurring vs exact) — cache correctness
5. **P3 — Integration tests** (real Prisma, test DB) — end-to-end validation
