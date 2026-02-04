---
description: Timezone and Date/Time Handling Rules for AEGIRA
globs: ["**/*.ts"]
alwaysApply: false
---
# Time Handling

AEGIRA operates across timezones. All time logic uses Luxon. All storage uses UTC.

## Core Rules

1. **Store ALL timestamps in UTC** in the database
2. **Company timezone** is stored in `company.timezone` column
3. **Convert to company timezone** for display and business logic only
4. **Use Luxon** for all timezone operations
5. **NEVER use `new Date()`** for business logic dates

## Shared Utilities (`shared/utils.ts`)

```typescript
getTodayInTimezone(tz: string): string
// Returns "2026-01-30" in the company's timezone

getCurrentTimeInTimezone(tz: string): string
// Returns "14:30" in the company's timezone

parseDateInTimezone(dateStr: string, tz: string): DateTime
// Parses a date string in the company's timezone

isTimeWithinWindow(current: string, start: string, end: string): boolean
// Checks if a time falls within a window
```

## Backend Usage

```typescript
import { getTodayInTimezone, isTimeWithinWindow } from '../../shared/utils';

// Get today's date in the company's timezone
const today = getTodayInTimezone(company.timezone);

// Check if check-in window is open
const currentTime = getCurrentTimeInTimezone(company.timezone);
const isOpen = isTimeWithinWindow(currentTime, '06:00', '10:00');
```

## Frontend Usage

```typescript
import { DateTime } from 'luxon';

// Display a UTC timestamp in the user's local timezone
const displayDate = DateTime
  .fromISO(utcTimestamp)
  .setZone(companyTimezone)
  .toFormat('MMM dd, yyyy HH:mm');
```

## Date Format for API

- Dates sent to API: `"YYYY-MM-DD"` string (e.g., `"2026-01-30"`)
- Timestamps from API: ISO 8601 UTC (e.g., `"2026-01-30T14:30:00.000Z"`)

## Rules

- NEVER use `new Date()` for business logic
- NEVER store dates in local timezone
- ALWAYS convert to company timezone before comparing dates/times
- ALWAYS use Luxon for date parsing and formatting
- ALWAYS use the shared utility functions (don't reinvent them)
- Date strings in API use `YYYY-MM-DD` format
- Validate date strings with Zod: `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`
- EVERY database query MUST filter by `company_id`
- NO `any` types — strict TypeScript
- Server state → TanStack Query, client state → Zustand (auth only)
- JWT in httpOnly cookie — no tokens in localStorage or Zustand
- Tailwind CSS only — no inline styles
- NEVER hard delete — use `is_active: false`
