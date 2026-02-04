---
name: backend-service
description: Generate a backend service layer for AEGIRA. Use when a feature needs business logic, multi-step operations, eligibility checks, or Prisma transactions beyond simple CRUD.
---
# Backend Service Layer

Add a service when the feature needs business logic beyond simple CRUD. Services sit between controllers and repositories.

## When to Use

- Multiple repository calls need coordination
- Complex business rules or eligibility checks
- Prisma `$transaction` for atomic multi-step writes
- Data transformation before/after database access
- Cross-module operations
- Timezone-aware date logic

For simple CRUD with no business logic, controllers call repositories directly.

## File Location

```
src/modules/<feature>/<feature>.service.ts
```

## Service Pattern

```typescript
import { Prisma, type Feature } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { FeatureRepository } from './<feature>.repository';
import { AppError } from '../../shared/errors';
import { prisma } from '../../config/database';
import {
  getTodayInTimezone,
  parseDateInTimezone,
  getCurrentTimeInTimezone,
  isTimeWithinWindow,
} from '../../shared/utils';
import type { CreateFeatureInput } from './<feature>.validator';

export class FeatureService {
  constructor(
    private readonly repository: FeatureRepository,
    private readonly timezone: string = 'Asia/Manila'
  ) {}

  async submit(
    input: CreateFeatureInput,
    personId: string,
    companyId: string
  ): Promise<Feature> {
    // 1. Timezone-aware date resolution
    const todayStr = getTodayInTimezone(this.timezone);
    const today = parseDateInTimezone(todayStr, this.timezone);

    // 2. Business rule validation
    const existing = await this.repository.findByDate(personId, today);
    if (existing) {
      throw new AppError('DUPLICATE_ENTRY', 'Already submitted for today', 409);
    }

    // 3. Additional business checks (e.g., schedule window)
    const currentTime = getCurrentTimeInTimezone(this.timezone);
    if (!isTimeWithinWindow(currentTime, '06:00', '10:00')) {
      throw new AppError('OUTSIDE_WINDOW', 'Submission window is 06:00–10:00', 400);
    }

    // 4. Event-sourced transaction (event + record atomically)
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Create event first (event sourcing)
        const event = await tx.event.create({
          data: {
            company_id: companyId,
            person_id: personId,
            event_type: 'FEATURE_SUBMITTED',
            entity_type: 'feature',
            payload: { ...input },
          },
        });

        // Create the actual record
        return tx.feature.create({
          data: {
            company_id: companyId,
            person_id: personId,
            event_id: event.id,
            feature_date: today,
            // ... mapped fields from input
          },
        });
      });

      return result;
    } catch (error) {
      // Catch unique constraint violations for friendly errors
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppError('DUPLICATE_ENTRY', 'Already submitted for today', 409);
      }
      throw error;
    }
  }

  /**
   * Example: Complex calculation logic
   */
  calculateScore(input: { hoursSlept: number; stressLevel: number }): number {
    const sleepScore = Math.min(input.hoursSlept / 8, 1) * 50;
    const stressScore = (1 - input.stressLevel / 10) * 50;
    return Math.round(sleepScore + stressScore);
  }
}
```

## Controller Integration

Use `c.get('companyTimezone')` from tenant middleware — no extra DB query needed:

```typescript
// In <feature>.controller.ts
import type { Context } from 'hono';
import type { AuthenticatedUser } from '../../types/api.types';
import { FeatureRepository } from './<feature>.repository';
import { FeatureService } from './<feature>.service';
import { prisma } from '../../config/database';
import { logAudit } from '../../shared/audit';

function getService(companyId: string, timezone: string): FeatureService {
  const repository = new FeatureRepository(prisma, companyId);
  return new FeatureService(repository, timezone);
}

export async function submit(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const timezone = c.get('companyTimezone') as string; // Already set by tenantMiddleware
  const data = c.req.valid('json');

  const service = getService(companyId, timezone);
  const result = await service.submit(data, userId, companyId);

  // Fire-and-forget audit log
  logAudit({
    companyId,
    personId: userId,
    action: 'SUBMIT_FEATURE',
    entityType: 'Feature',
    entityId: result.id,
  });

  return c.json({ success: true, data: result }, 201);
}
```

## Context Variables Available in Controllers

```typescript
const companyId = c.get('companyId') as string;       // From authMiddleware
const userId = c.get('userId') as string;             // From authMiddleware
const user = c.get('user') as AuthenticatedUser;      // From authMiddleware
const userRole = c.get('userRole') as string;         // From authMiddleware
const timezone = c.get('companyTimezone') as string;  // From tenantMiddleware (defaults to 'Asia/Manila')
```

## Timezone Utilities Reference

Available from `../../shared/utils`:

```typescript
getTodayInTimezone(timezone)                    // → "2024-01-15" (company-local date)
getCurrentTimeInTimezone(timezone)              // → "08:30" (company-local time)
getDayOfWeekInTimezone(timezone, date?)         // → 0–6 (0 = Sunday)
isTimeWithinWindow(currentTime, start, end)     // → boolean (supports cross-midnight)
parseDateInTimezone(dateStr, timezone)           // → Date (UTC midnight for that local date)
formatDateInTimezone(date, timezone)             // → "2024-01-15"
```

## Key Rules

- Services contain business logic ONLY (no HTTP concerns)
- Services receive repositories via constructor (dependency injection)
- Services throw `AppError` for business rule violations
- Services use `prisma.$transaction` for atomic multi-step writes
- Services are stateless (no instance state beyond injected dependencies)
- ALWAYS get timezone from `c.get('companyTimezone')` in the controller — never query the DB for it
- ALWAYS catch `Prisma.PrismaClientKnownRequestError` P2002 for unique constraints
- ALWAYS use timezone utilities from `shared/utils` for date/time operations
- ALWAYS include fire-and-forget `logAudit()` in the controller after service calls
- NEVER access `c` (Hono context) in services
- NEVER import Hono types in service files
- NEVER query the company table for timezone — tenant middleware already caches it on context
