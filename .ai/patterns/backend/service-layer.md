# Service Layer Pattern
> Complex business logic - multi-repo operations, transactions, calculations (add ONLY when needed)

## When to Use
- Multi-step operations that span multiple repositories
- Operations requiring `$transaction` for atomicity
- Complex business logic with calculations (e.g., readiness scores)
- Eligibility checks before data mutations
- When a controller would otherwise have more than 5 lines of business logic

## When NOT to Use
- Simple CRUD operations (use repository directly from controller)
- Single-repo operations with no business logic
- Proxy functions that just delegate to a single repo method

## Decision Tree
```
Does the operation...
├── Involve multiple repositories?  → YES → Add Service
├── Need $transaction for atomicity? → YES → Add Service
├── Have complex calculations?       → YES → Add Service
├── Check eligibility/business rules before mutation? → YES → Add Service
└── Just call one repo method?       → NO  → Controller → Repository directly
```

## Canonical Implementation

### Service Class Structure
```typescript
import type { PrismaClient } from '@prisma/client';
import { CheckInRepository, CreateCheckInData } from './check-in.repository';
import { AppError } from '../../shared/errors';
import type { CheckInInput, ReadinessScore } from '../../types/domain.types';
import { prisma } from '../../config/database';
import {
  getTodayInTimezone,
  getCurrentTimeInTimezone,
  getDayOfWeekInTimezone,
  isTimeWithinWindow,
  parseDateInTimezone,
} from '../../shared/utils';

export class CheckInService {
  constructor(
    private readonly repository: CheckInRepository,
    private readonly timezone: string = 'Asia/Manila'
  ) {}

  async submit(
    input: CheckInInput,
    personId: string,
    companyId: string
  ): Promise<CheckIn> {
    // 1. Get today's date in company timezone
    const todayStr = getTodayInTimezone(this.timezone);
    const today = parseDateInTimezone(todayStr, this.timezone);

    // 2. Business rule checks
    const person = await this.repository.getPersonWithTeam(personId);
    if (person?.team) {
      const dayOfWeek = getDayOfWeekInTimezone(this.timezone).toString();
      if (!schedule.workDays.includes(dayOfWeek)) {
        throw new AppError('NOT_WORK_DAY', 'Today is not a scheduled work day', 400);
      }

      const currentTime = getCurrentTimeInTimezone(this.timezone);
      if (!isTimeWithinWindow(currentTime, schedule.checkInStart, schedule.checkInEnd)) {
        throw new AppError(
          'OUTSIDE_CHECK_IN_WINDOW',
          `Check-in allowed between ${schedule.checkInStart} and ${schedule.checkInEnd}`,
          400
        );
      }
    }

    // 3. Calculate derived values
    const readiness = this.calculateReadiness(input);

    // 4. Atomic transaction (event sourcing + data insert)
    try {
      return await prisma.$transaction(async (tx) => {
        const event = await tx.event.create({
          data: {
            company_id: companyId,
            person_id: personId,
            event_type: 'CHECK_IN_SUBMITTED',
            entity_type: 'check_in',
            payload: { ...input, readiness },
          },
        });

        return tx.checkIn.create({
          data: {
            company_id: companyId,
            person_id: personId,
            event_id: event.id,
            check_in_date: today,
            hours_slept: input.hoursSlept,
            readiness_score: readiness.overall,
            readiness_level: readiness.level,
            // ... other fields
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppError('DUPLICATE_CHECK_IN', 'Check-in already submitted for today', 409);
      }
      throw error;
    }
  }

  private calculateReadiness(input: CheckInInput): ReadinessScore {
    // Complex business calculation
    const sleepScore = this.calculateSleepScore(input.hoursSlept, input.sleepQuality);
    const stressScore = Math.round((10 - input.stressLevel + 1) * 10);
    const physicalScore = input.physicalCondition * 10;

    const overall = Math.round(
      sleepScore * 0.4 + stressScore * 0.3 + physicalScore * 0.3
    );

    return {
      overall,
      level: overall >= 70 ? 'GREEN' : overall >= 50 ? 'YELLOW' : 'RED',
      factors: { sleep: sleepScore, stress: stressScore, physical: physicalScore },
    };
  }
}
```

### Service with Analytics (Multi-Table Aggregation)
```typescript
export class TeamService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly companyId: string
  ) {}

  async getTeamAnalytics(
    period: string,
    timezone: string,
    teamIds: string[] | null
  ): Promise<TeamAnalyticsResult> {
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    const todayStr = getTodayInTimezone(timezone);
    const endDate = parseDateInTimezone(todayStr, timezone);
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    // Build filters based on team context
    const checkInTeamFilter = teamIds
      ? { person: { team_id: { in: teamIds } } }
      : {};

    // Parallel queries for performance
    const [checkIns, workers] = await Promise.all([
      this.prisma.checkIn.findMany({
        where: {
          company_id: this.companyId,
          check_in_date: { gte: startDate, lte: endDate },
          ...checkInTeamFilter,
        },
        select: { check_in_date: true, readiness_score: true, readiness_level: true },
      }),
      this.prisma.person.findMany({
        where: {
          company_id: this.companyId,
          role: 'WORKER',
          is_active: true,
          ...(teamIds ? { team_id: { in: teamIds } } : {}),
        },
      }),
    ]);

    // Process and aggregate results...
    return { period, summary, trends, records };
  }
}
```

### Controller Instantiation Pattern
```typescript
// Simple CRUD: Controller uses repository directly
function getRepository(companyId: string): PersonRepository {
  return new PersonRepository(prisma, companyId);
}

// Complex module: Controller uses service (which uses repository internally)
function getService(companyId: string, timezone: string): CheckInService {
  const repository = new CheckInRepository(prisma, companyId);
  return new CheckInService(repository, timezone);
}

// Analytics module: Controller uses service with just prisma + companyId
export async function getTeamAnalytics(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const timezone = c.get('companyTimezone') as string;

  const teamService = new TeamService(prisma, companyId);
  const analytics = await teamService.getTeamAnalytics(period, timezone, teamIds);

  return c.json({ success: true, data: analytics });
}
```

## Rules
- ✅ DO add service layer ONLY for multi-step operations, transactions, or complex calculations
- ✅ DO use `$transaction` for atomic operations that must succeed or fail together
- ✅ DO pass `timezone` as a constructor parameter (from `c.get('companyTimezone')`)
- ✅ DO use `readonly` modifier on constructor parameters
- ✅ DO define result interfaces for complex return types
- ✅ DO use `Promise.all` for independent parallel queries within services
- ✅ DO catch Prisma errors (P2002, P2003) and convert to `AppError`
- ✅ DO keep private helper methods for calculations (e.g., `calculateReadiness`)
- ❌ NEVER add service for simple CRUD (controller calls repository directly)
- ❌ NEVER put data access (Prisma queries) in service when a repository exists for that model
- ❌ NEVER put response formatting in service (that belongs in controller)
- ❌ NEVER instantiate services at module level (create per-request via factory function)

## Common Mistakes

### WRONG: Service for Simple CRUD (Unnecessary Proxy)
```typescript
// team.service.ts
export class TeamService {
  async findAll(page: number, limit: number) {
    const repo = new TeamRepository(this.prisma, this.companyId);
    return repo.findAll(page, limit); // Just proxying - no business logic
  }

  async findById(id: string) {
    const repo = new TeamRepository(this.prisma, this.companyId);
    return repo.findById(id); // Just proxying - no business logic
  }
}
```

### CORRECT: Controller Uses Repository Directly
```typescript
// team.controller.ts
export async function listTeams(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'));

  const repository = getRepository(companyId);
  const result = await repository.findAll({ page, limit });

  return c.json({ success: true, data: result });
}
```

### WRONG: Business Logic in Controller
```typescript
// check-in.controller.ts
export async function submitCheckIn(c: Context): Promise<Response> {
  const data = await c.req.json();
  const companyId = c.get('companyId') as string;

  // WRONG - eligibility checks and calculations in controller
  const person = await prisma.person.findFirst({ where: { id: userId } });
  const dayOfWeek = getDayOfWeekInTimezone(timezone);
  if (!person?.team?.work_days?.includes(dayOfWeek)) {
    throw new AppError('NOT_WORK_DAY', 'Today is not a work day', 400);
  }
  const sleepScore = (data.hoursSlept >= 7 ? 100 : 60);
  // ... more calculations ...

  const result = await prisma.$transaction(async (tx) => { /* ... */ });
  return c.json({ success: true, data: result }, 201);
}
```

### CORRECT: Delegate to Service
```typescript
// check-in.controller.ts
export async function submitCheckIn(c: Context): Promise<Response> {
  const data = await c.req.json() as CheckInInput;
  const user = c.get('user') as AuthenticatedUser;
  const companyId = c.get('companyId') as string;

  // CORRECT - service handles all business logic
  const service = getService(companyId, c.get('companyTimezone') as string);
  const result = await service.submit(data, user.id, companyId);

  return c.json({ success: true, data: result }, 201);
}
```

### WRONG: Missing Transaction for Multi-Step
```typescript
export class CheckInService {
  async submit(input: CheckInInput, personId: string, companyId: string) {
    // WRONG - event and check-in not atomic; if checkIn.create fails,
    // orphan event remains in database
    const event = await this.prisma.event.create({ data: { ... } });
    const checkIn = await this.prisma.checkIn.create({ data: { event_id: event.id, ... } });
    return checkIn;
  }
}
```

### CORRECT: Use $transaction for Atomicity
```typescript
export class CheckInService {
  async submit(input: CheckInInput, personId: string, companyId: string) {
    // CORRECT - both operations succeed or fail together
    return prisma.$transaction(async (tx) => {
      const event = await tx.event.create({ data: { ... } });
      return tx.checkIn.create({ data: { event_id: event.id, ... } });
    });
  }
}
```
