# Schedule Resolution Pattern
> Worker schedule override with team fallback — per-field resolution with runtime safety guards

## When to Use
- Determining a worker's effective schedule (work days, check-in window)
- Checking if today is a work day for a specific worker
- Any operation that needs to know when a worker should check in
- Missed check-in detection, dashboard calculations, check-in eligibility

## Canonical Implementation

### getEffectiveSchedule — Resolve Worker Override + Team Fallback
```typescript
import {
  getEffectiveSchedule,
  isWorkDay,
  type PersonSchedule,
  type TeamSchedule,
  type EffectiveSchedule,
} from '../../shared/schedule.utils';

// Worker has optional overrides; team has required defaults.
// Each field resolves independently — partial overrides are supported.
const schedule: EffectiveSchedule = getEffectiveSchedule(
  {
    work_days: worker.work_days,         // "1,3,5" or null
    check_in_start: worker.check_in_start, // "07:00" or null
    check_in_end: worker.check_in_end,     // "09:00" or null
  },
  {
    work_days: team.work_days,           // "1,2,3,4,5" (required)
    check_in_start: team.check_in_start, // "06:00" (required)
    check_in_end: team.check_in_end,     // "10:00" (required)
  }
);

// Result:
// schedule.workDays     → ["1", "3", "5"]  (worker override)
// schedule.checkInStart → "07:00"          (worker override)
// schedule.checkInEnd   → "09:00"          (worker override)
```

### Partial Override Example
```typescript
// Worker overrides ONLY work_days, keeps team's check-in times
const schedule = getEffectiveSchedule(
  { work_days: "1,3,5", check_in_start: null, check_in_end: null },
  { work_days: "1,2,3,4,5", check_in_start: "06:00", check_in_end: "10:00" }
);
// → { workDays: ["1","3","5"], checkInStart: "06:00", checkInEnd: "10:00" }
```

### isWorkDay — Quick Day Check
```typescript
import { isWorkDay } from '../../shared/schedule.utils';

const dayOfWeek = todayDt.weekday === 7 ? '0' : String(todayDt.weekday);
// "0" = Sunday, "1" = Monday, ..., "6" = Saturday

const isScheduledToday = isWorkDay(
  dayOfWeek,
  { work_days: worker.work_days },
  { work_days: team.work_days, check_in_start: team.check_in_start, check_in_end: team.check_in_end }
);
```

### Using in Services (Check-In Eligibility)
```typescript
async submit(input: CheckInInput, personId: string, companyId: string) {
  const person = await this.repository.getPersonWithTeam(personId);
  if (!person?.team) throw new AppError('NO_TEAM', 'Worker not assigned to a team', 400);

  const schedule = getEffectiveSchedule(person, person.team);

  // Check if today is a work day
  const dayOfWeek = getDayOfWeekInTimezone(this.timezone).toString();
  if (!schedule.workDays.includes(dayOfWeek)) {
    throw new AppError('NOT_WORK_DAY', 'Today is not a scheduled work day', 400);
  }

  // Check if current time is within the check-in window
  const currentTime = getCurrentTimeInTimezone(this.timezone);
  if (currentTime < schedule.checkInStart) {
    throw new AppError('TOO_EARLY', `Check-in opens at ${schedule.checkInStart}`, 400);
  }
  // Late submissions are allowed — only "too early" is rejected
}
```

### Interfaces
```typescript
// Worker schedule fields — all nullable (override is optional)
interface PersonSchedule {
  work_days?: string | null;      // CSV: "1,3,5" or null
  check_in_start?: string | null; // HH:mm or null
  check_in_end?: string | null;   // HH:mm or null
}

// Team schedule fields — all required (always has defaults)
interface TeamSchedule {
  work_days: string;      // CSV: "1,2,3,4,5"
  check_in_start: string; // HH:mm: "06:00"
  check_in_end: string;   // HH:mm: "10:00"
}

// Resolved schedule — always complete
interface EffectiveSchedule {
  workDays: string[];   // ["1", "2", "3", "4", "5"]
  checkInStart: string; // "06:00"
  checkInEnd: string;   // "10:00"
}
```

### Runtime Safety Guard
```typescript
// If a partial override creates an inverted window (start >= end),
// getEffectiveSchedule() automatically falls back to the team's window.
//
// Example: worker overrides check_in_start to "11:00" but keeps team's
// check_in_end "10:00" → inverted! Falls back to team's "06:00"–"10:00".
```

## Validation Constants
```typescript
// Time format (HH:MM, zero-padded for consistent string comparison)
export const TIME_REGEX = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

// Work days (CSV of 0-6, no duplicates)
export const WORK_DAYS_REGEX = /^[0-6](,[0-6])*$/;
```

## Rules
- ✅ **DO** always use `getEffectiveSchedule()` — never manually resolve worker vs team schedule
- ✅ **DO** pass the full `PersonSchedule` and `TeamSchedule` objects (not individual fields)
- ✅ **DO** handle the inverted window guard transparently (it's built-in)
- ✅ **DO** use `isWorkDay()` for simple day-of-week checks (avoids parsing the full schedule)
- ✅ **DO** use Luxon weekday mapping: `weekday === 7 ? "0" : String(weekday)` for Sunday
- ❌ **NEVER** manually check `person.work_days ?? team.work_days` in business code — use the utility
- ❌ **NEVER** assume cross-midnight windows work — validator enforces `checkInEnd > checkInStart`
- ❌ **NEVER** skip the team fallback — even if the worker has SOME overrides, missing fields must fall back

## Common Mistakes

### WRONG: Manual field-by-field resolution
```typescript
// WRONG — doesn't handle partial overrides or inverted window guard
const workDays = (worker.work_days || team.work_days).split(',');
const start = worker.check_in_start || team.check_in_start;
const end = worker.check_in_end || team.check_in_end;
```

### CORRECT: Use getEffectiveSchedule
```typescript
const schedule = getEffectiveSchedule(
  { work_days: worker.work_days, check_in_start: worker.check_in_start, check_in_end: worker.check_in_end },
  { work_days: team.work_days, check_in_start: team.check_in_start, check_in_end: team.check_in_end }
);
// schedule.workDays, schedule.checkInStart, schedule.checkInEnd — always valid
```

### WRONG: Using empty string as falsy for override check
```typescript
// WRONG — empty string "" is falsy but different from null (means "no override")
const workDays = worker.work_days || team.work_days;
```

### CORRECT: Use nullish coalescing (built into getEffectiveSchedule)
```typescript
// CORRECT — getEffectiveSchedule uses ?? (nullish coalescing), not || (logical or)
// Empty string is treated as a value, null/undefined triggers fallback
const schedule = getEffectiveSchedule(worker, team);
```
