---
name: backend-service
description: Generate a backend service layer for AEGIRA. Use when a feature needs business logic, multi-step operations, eligibility checks, or Prisma transactions beyond simple CRUD.
---
# Backend Service Layer

Add a service when the feature needs business logic beyond simple CRUD. Services sit between controllers and repositories.

## When to Use

<!-- BUILT FROM: .ai/patterns/shared/decision-trees.md -->
# Decision Trees
> When to use what - service layer, stale times, keepPreviousData, transactions, custom hooks

## When to Use
- When deciding on the architecture for a new feature or endpoint
- When unsure about the correct pattern for a specific situation
- When reviewing code for pattern compliance

## Canonical Implementation

### Decision 1: When to Add a Service Layer

```
Does the controller need to...
├── Use multiple repositories?
│   └── YES → Add service layer
├── Perform complex calculations?
│   └── YES → Add service layer
├── Run a database transaction?
│   └── YES → Add service layer
├── Coordinate multiple side effects?
│   └── YES → Add service layer
└── Just do simple CRUD?
    └── NO service layer → Controller calls Repository directly
```

**Examples:**

| Operation | Service Needed? | Why |
|-----------|----------------|-----|
| List teams | No | Simple query, one repository |
| Create person | No | Single insert, one repository |
| Submit check-in | Yes | Readiness calculation + eligibility check + create |
| Assign team members | Yes | Multiple repos (team + person) + transaction |
| Process incident | Yes | Create incident + create case + notify + audit |
| Get person by ID | No | Simple query, one repository |
| Delete team | No | Single operation, one repository |
| Generate dashboard stats | Yes | Multiple repos + aggregation + calculations |

```typescript
// NO service: controller → repository directly
export async function list(c: Context) {
  const companyId = c.get('companyId') as string;
  const repo = new TeamRepository(c.get('prisma'), companyId);
  const result = await repo.findAll(page, limit);
  return c.json({ success: true, data: paginate(result.items, page, limit, result.total) });
}

// YES service: controller → service → repository
export async function submitCheckIn(c: Context) {
  const companyId = c.get('companyId') as string;
  const service = new CheckInService(c.get('prisma'), companyId);
  const result = await service.submitCheckIn(userId, body);
  return c.json({ success: true, data: result }, 201);
}
```

---

### Decision 2: Which Stale Time

```
How often does this data change?
├── Every few seconds (live metrics, notifications, dashboard)
│   └── REALTIME (30s)
├── Every few minutes (team lists, person lists, detail pages)
│   └── STANDARD (2m)
├── Rarely changes (analytics, company settings, historical data)
│   └── STATIC (10m)
└── Basically never changes (holidays, reference data, immutable records)
    └── IMMUTABLE (30m)
```

| Data Type | Stale Time | Constant | Duration |
|-----------|-----------|----------|----------|
| Dashboard stats (WHS, Admin) | `REALTIME` | `STALE_TIMES.REALTIME` | 30 seconds |
| Notification list/count | `REALTIME` | `STALE_TIMES.REALTIME` | 30 seconds |
| Check-in status | `REALTIME` | `STALE_TIMES.REALTIME` | 30 seconds |
| Team list | `STANDARD` | `STALE_TIMES.STANDARD` | 2 minutes |
| Person list/detail | `STANDARD` | `STALE_TIMES.STANDARD` | 2 minutes |
| Incident list | `STANDARD` | `STALE_TIMES.STANDARD` | 2 minutes |
| WHS analytics (period-based) | `STATIC` | `STALE_TIMES.STATIC` | 10 minutes |
| Company settings | `STATIC` | `STALE_TIMES.STATIC` | 10 minutes |
| Check-in history | `IMMUTABLE` | `STALE_TIMES.IMMUTABLE` | 30 minutes |
| Audit logs | `IMMUTABLE` | `STALE_TIMES.IMMUTABLE` | 30 minutes |
| Holidays | `IMMUTABLE` | `STALE_TIMES.IMMUTABLE` | 30 minutes |

```typescript
// Import from config
import { STALE_TIMES } from '@/config/query.config';

// NEVER hardcode values
staleTime: STALE_TIMES.REALTIME,   // 30_000
staleTime: STALE_TIMES.STANDARD,   // 120_000
staleTime: STALE_TIMES.STATIC,     // 600_000
staleTime: STALE_TIMES.IMMUTABLE,  // 1_800_000
```

---

### Decision 3: When to Use keepPreviousData

```
Does the query have parameters that change frequently?
├── Paginated list? (page, limit change)
│   └── YES → Use keepPreviousData
├── Search/filter changes? (debounced search string)
│   └── YES → Use keepPreviousData
├── Period selector? (7d, 30d, 90d)
│   └── YES → Use keepPreviousData
├── Tab-based filtering?
│   └── YES → Use keepPreviousData
└── Single entity by ID? (detail page)
    └── NO → Don't use keepPreviousData
```

```typescript
import { keepPreviousData } from '@tanstack/react-query';

// Paginated list → YES
export function useTeams(page: number, limit: number, search: string) {
  return useQuery({
    queryKey: ['teams', page, limit, search],
    staleTime: STALE_TIMES.STANDARD,
    placeholderData: keepPreviousData, // Smooth page transitions
    queryFn: async () => { /* ... */ },
  });
}

// Period-based analytics → YES
export function useWhsAnalytics(period: AnalyticsPeriod) {
  return useQuery({
    queryKey: ['analytics', 'whs', period],
    staleTime: STALE_TIMES.STATIC,
    placeholderData: keepPreviousData, // Smooth period switching
    queryFn: async () => { /* ... */ },
  });
}

// Single entity detail → NO
export function useTeam(teamId: string) {
  return useQuery({
    queryKey: ['team', teamId],
    staleTime: STALE_TIMES.STANDARD,
    enabled: !!teamId,
    // NO keepPreviousData — different entity entirely
    queryFn: async () => { /* ... */ },
  });
}
```

---

### Decision 4: When to Use Database Transactions

```
Does the operation...
├── Write to multiple tables?
│   └── YES → Use $transaction
├── Need atomicity (all-or-nothing)?
│   └── YES → Use $transaction
├── Read-then-write with consistency needs?
│   └── YES → Use $transaction
└── Single table insert/update/delete?
    └── NO → No transaction needed
```

```typescript
// SINGLE table operation → No transaction
async create(data: CreateTeamInput): Promise<Team> {
  return this.prisma.team.create({
    data: this.withCompany({ name: data.name }),
  });
}

// MULTI-table operation → Use transaction
async assignMembers(teamId: string, memberIds: string[]): Promise<void> {
  await this.prisma.$transaction(async (tx) => {
    // Verify team exists
    const team = await tx.team.findFirst({
      where: { id: teamId, company_id: this.companyId },
    });
    if (!team) throw Errors.notFound('Team');

    // Update all persons' team_id
    await tx.person.updateMany({
      where: {
        id: { in: memberIds },
        company_id: this.companyId,
      },
      data: { team_id: teamId },
    });
  });
}
```

---

### Decision 5: When to Extract Custom Hooks

```
Is the logic...
├── Used in 2+ components?
│   └── YES → Extract to shared hook
├── Complex state management (multiple useState + useEffect)?
│   └── YES → Extract to feature hook
├── API data fetching?
│   └── YES → ALWAYS create a query/mutation hook
├── Simple one-liner (single useState)?
│   └── NO → Keep inline in component
└── Business logic calculation?
    └── YES → Extract to utility function (not hook)
```

```typescript
// ALWAYS: API hooks in features/<feature>/hooks/
// useTeams.ts, useCreateTeam.ts, useWhsAnalytics.ts

// SHARED: Reusable behavior across features
// lib/hooks/use-debounce.ts, lib/hooks/use-toast.ts

// INLINE: Simple component-local state
const [isOpen, setIsOpen] = useState(false);  // Keep inline, don't extract

// UTILITY: Pure computation (not a hook)
// lib/utils/format.utils.ts → formatPercentage(value)
// lib/utils/date.utils.ts → formatRelativeTime(date)
```

---

### Decision 6: Where to Put Types

```
Is the type...
├── Used by multiple features?
│   └── src/types/<domain>.types.ts
├── Used only in one feature's hooks?
│   └── Co-locate in the hook file, re-export
├── A Zod schema inferred type (backend)?
│   └── Export from <feature>.validator.ts
├── Component props?
│   └── Define inline in the component file
└── API response shape?
    └── src/types/<domain>.types.ts
```

## Rules
- ✅ DO add a service layer when there are multi-repo operations, calculations, or transactions
- ✅ DO use the stale time constant that matches the data's update frequency
- ✅ DO use `keepPreviousData` for any query with user-controlled parameters (pagination, search, filters, period)
- ✅ DO use `$transaction` for multi-table writes that must be atomic
- ✅ DO extract API hooks for ALL data fetching (never inline `useQuery` in components)
- ✅ DO put shared types in `src/types/`, feature-local types in hook files
- ❌ NEVER create a service layer for simple CRUD (just proxies to repository)
- ❌ NEVER hardcode stale time values (always use `STALE_TIMES` constants)
- ❌ NEVER use `keepPreviousData` for single-entity detail queries
- ❌ NEVER skip transactions for multi-table write operations
- ❌ NEVER put business logic in utility functions that should be hooks (anything using React state/effects)

## Common Mistakes

### ❌ WRONG: Unnecessary service layer
```typescript
// Service that just proxies to repository — add no value
export class TeamService {
  async findAll(page: number, limit: number) {
    const repo = new TeamRepository(this.prisma, this.companyId);
    return repo.findAll(page, limit); // Just proxying!
  }
}
```

### ✅ CORRECT: Skip service for simple CRUD
```typescript
// Controller calls repository directly
export async function list(c: Context) {
  const companyId = c.get('companyId') as string;
  const repo = new TeamRepository(c.get('prisma'), companyId);
  const { items, total } = await repo.findAll(page, limit);
  return c.json({ success: true, data: paginate(items, page, limit, total) });
}
```

### ❌ WRONG: keepPreviousData on detail query
```typescript
export function useTeam(teamId: string) {
  return useQuery({
    queryKey: ['team', teamId],
    placeholderData: keepPreviousData, // WRONG: shows Team A data while loading Team B
    queryFn: () => apiClient.get<Team>(ENDPOINTS.TEAM.BY_ID(teamId)),
  });
}
```

### ✅ CORRECT: No keepPreviousData on detail queries
```typescript
export function useTeam(teamId: string) {
  return useQuery({
    queryKey: ['team', teamId],
    staleTime: STALE_TIMES.STANDARD,
    enabled: !!teamId,
    // No keepPreviousData — each entity is distinct
    queryFn: () => apiClient.get<Team>(ENDPOINTS.TEAM.BY_ID(teamId)),
  });
}
```


## File Location

```
src/modules/<feature>/<feature>.service.ts
```

## Service Layer Pattern

<!-- BUILT FROM: .ai/patterns/backend/service-layer.md -->
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


## Controller Integration

<!-- BUILT FROM: .ai/patterns/backend/controller-pattern.md -->
# Controller Pattern
> Request handling layer - parse input, call service/repo, format response, fire-and-forget audit

## When to Use
- Every backend module endpoint handler
- When parsing request parameters, body, and query strings
- When formatting responses with the standard `{ success, data }` wrapper
- When firing off non-blocking side effects (audit logs, notifications)

## Canonical Implementation

### Basic Controller Structure
```typescript
import type { Context } from 'hono';
import { PersonRepository } from './person.repository';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/errors';
import { parsePagination } from '../../shared/utils';
import { logAudit } from '../../shared/audit';
import type { AuthenticatedUser } from '../../types/api.types';
import type { CreatePersonInput } from './person.validator';

// Helper to create repository with tenant scope
function getRepository(companyId: string): PersonRepository {
  return new PersonRepository(prisma, companyId);
}
```

### List Controller (Paginated)
```typescript
export async function listPersons(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'));
  const search = c.req.query('search')?.trim();
  const includeInactive = c.req.query('includeInactive') === 'true';

  const repository = getRepository(companyId);
  const result = await repository.findAll({ page, limit, includeInactive, search });

  return c.json({ success: true, data: result });
}
```

### GetById Controller
```typescript
export async function getPersonById(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const id = c.req.param('id');

  if (!id) {
    throw new AppError('VALIDATION_ERROR', 'Person ID is required', 400);
  }

  const repository = getRepository(companyId);
  const result = await repository.findById(id);

  if (!result) {
    throw new AppError('NOT_FOUND', 'Person not found', 404);
  }

  return c.json({ success: true, data: result });
}
```

### Create Controller (with Audit)
```typescript
export async function createPerson(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const data = await c.req.json() as CreatePersonInput;

  const repository = getRepository(companyId);
  const result = await repository.create(data);

  // Audit (fire-and-forget - never await, never throw)
  logAudit({
    companyId,
    personId: userId,
    action: 'CREATE_PERSON',
    entityType: 'PERSON',
    entityId: result.id,
    details: { email: data.email, role: data.role },
  });

  return c.json({ success: true, data: result }, 201);
}
```

### Update Controller (with Audit)
```typescript
export async function updatePerson(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const data = await c.req.json() as UpdatePersonInput;

  if (!id) {
    throw new AppError('VALIDATION_ERROR', 'Person ID is required', 400);
  }

  const repository = getRepository(companyId);
  const existing = await repository.findById(id);
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Person not found', 404);
  }

  const result = await repository.update(id, data);

  // Audit (fire-and-forget)
  logAudit({
    companyId,
    personId: userId,
    action: 'UPDATE_PERSON',
    entityType: 'PERSON',
    entityId: id,
    details: data as Record<string, unknown>,
  });

  return c.json({ success: true, data: result });
}
```

### Controller with Service Layer (Complex Logic)
```typescript
// When module has a service, create a service factory instead of repo factory
function getService(companyId: string, timezone: string): CheckInService {
  const repository = new CheckInRepository(prisma, companyId);
  return new CheckInService(repository, timezone);
}

export async function submitCheckIn(c: Context): Promise<Response> {
  const data = await c.req.json() as CheckInInput;
  const user = c.get('user') as AuthenticatedUser;
  const companyId = c.get('companyId') as string;

  const service = getService(companyId, c.get('companyTimezone') as string);
  const result = await service.submit(data, user.id, companyId);

  return c.json({ success: true, data: result }, 201);
}
```

### Non-blocking Notification Helper
```typescript
/**
 * Send notification when team lead is assigned.
 * Non-blocking - errors are logged but don't break the main operation.
 */
async function notifyTeamLeadAssignment(
  companyId: string,
  leaderId: string,
  teamName: string
): Promise<void> {
  try {
    const notificationRepo = new NotificationRepository(prisma, companyId);
    await notificationRepo.create({
      personId: leaderId,
      type: 'TEAM_ALERT',
      title: 'Team Leadership Assignment',
      message: `You have been assigned as the team lead of ${teamName}.`,
    });
  } catch (error) {
    logger.error({ error, leaderId, teamName }, 'Failed to send team lead assignment notification');
  }
}

// Called without await in the controller:
export async function createTeam(c: Context): Promise<Response> {
  // ... create team ...
  notifyTeamLeadAssignment(companyId, data.leaderId, result.name); // No await
  logAudit({ /* ... */ }); // No await
  return c.json({ success: true, data: result }, 201);
}
```

### Context Variables Available After Middleware
| Variable | Type | Usage |
|----------|------|-------|
| `c.get('companyId')` | `string` | Current tenant ID |
| `c.get('userId')` | `string` | Current user ID |
| `c.get('userRole')` | `string` | Current user role |
| `c.get('user')` | `AuthenticatedUser` | Full user object |
| `c.get('companyTimezone')` | `string` | Company timezone (e.g., `'Asia/Manila'`) |

## Rules
- ✅ DO export controller functions (not classes)
- ✅ DO use `parsePagination(c.req.query('page'), c.req.query('limit'))` for list endpoints
- ✅ DO return `{ success: true, data }` for all success responses
- ✅ DO return HTTP `201` for create operations, `200` for reads/updates/deletes
- ✅ DO fire-and-forget `logAudit()` calls (never `await`)
- ✅ DO extract `companyId` from `c.get('companyId')`, never from request body
- ✅ DO extract `userId` from `c.get('userId')` for audit trails
- ✅ DO use a `getRepository()` or `getService()` helper factory function
- ✅ DO use `as string` for context getters: `c.get('companyId') as string`
- ❌ NEVER put business logic in controllers (delegate to service)
- ❌ NEVER put Prisma queries in controllers (delegate to repository)
- ❌ NEVER `await` audit logging or notification calls
- ❌ NEVER trust client-provided `companyId` -- always use `c.get('companyId')`
- ❌ NEVER catch errors unless you need to transform them -- let the global error handler catch

## Common Mistakes

### WRONG: Prisma Query in Controller
```typescript
export async function createTeam(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const body = await c.req.json();

  // WRONG - direct Prisma query in controller
  const team = await prisma.team.create({
    data: { ...body, company_id: companyId },
  });

  return c.json({ success: true, data: team });
}
```

### CORRECT: Use Repository
```typescript
export async function createTeam(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const body = await c.req.json() as CreateTeamInput;

  const repository = getRepository(companyId);
  const team = await repository.create(body);

  logAudit({
    companyId,
    personId: userId,
    action: 'CREATE_TEAM',
    entityType: 'TEAM',
    entityId: team.id,
    details: { name: body.name },
  });

  return c.json({ success: true, data: team }, 201);
}
```

### WRONG: Awaiting Audit Log
```typescript
export async function createPerson(c: Context): Promise<Response> {
  const result = await repository.create(data);

  // WRONG - awaiting audit log blocks the response
  await logAudit({
    companyId,
    personId: userId,
    action: 'CREATE_PERSON',
    entityType: 'PERSON',
    entityId: result.id,
  });

  return c.json({ success: true, data: result }, 201);
}
```

### CORRECT: Fire-and-Forget Audit
```typescript
export async function createPerson(c: Context): Promise<Response> {
  const result = await repository.create(data);

  // CORRECT - fire-and-forget, no await
  logAudit({
    companyId,
    personId: userId,
    action: 'CREATE_PERSON',
    entityType: 'PERSON',
    entityId: result.id,
  });

  return c.json({ success: true, data: result }, 201);
}
```

### WRONG: Missing Response Wrapper
```typescript
export async function listTeams(c: Context): Promise<Response> {
  const result = await repository.findAll({ page, limit });
  // WRONG - returning raw data without success wrapper
  return c.json(result);
}
```

### CORRECT: Standard Response Format
```typescript
export async function listTeams(c: Context): Promise<Response> {
  const result = await repository.findAll({ page, limit });
  // CORRECT - wrapped in { success, data }
  return c.json({ success: true, data: result });
}
```


## Error Handling

<!-- BUILT FROM: .ai/patterns/backend/error-handling.md -->
# Error Handling (Backend)
> AppError class with structured codes, Prisma error mapping, and global error handler

## When to Use
- Every backend module that needs to throw business errors
- When mapping Prisma database errors to user-friendly responses
- When defining error responses for validation, auth, and domain-specific failures
- When handling unexpected errors gracefully in production

## Canonical Implementation

### AppError Class
```typescript
// shared/errors.ts
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}
```

### Factory Functions for Common Errors
```typescript
// shared/errors.ts
export const Errors = {
  notFound: (resource: string): AppError =>
    new AppError('NOT_FOUND', `${resource} not found`, 404),

  unauthorized: (message = 'Unauthorized'): AppError =>
    new AppError('UNAUTHORIZED', message, 401),

  forbidden: (message = 'Access denied'): AppError =>
    new AppError('FORBIDDEN', message, 403),

  conflict: (message: string): AppError =>
    new AppError('CONFLICT', message, 409),

  validation: (message: string): AppError =>
    new AppError('VALIDATION_ERROR', message, 400),

  internal: (message = 'Internal server error'): AppError =>
    new AppError('INTERNAL_ERROR', message, 500),
};
```

### Usage in Controllers and Services
```typescript
import { AppError, Errors } from '../../shared/errors';

// Using factory functions for standard cases
const team = await repository.findById(id);
if (!team) {
  throw Errors.notFound('Team');
}

// Using AppError directly for domain-specific errors
throw new AppError('DUPLICATE_CHECK_IN', 'Check-in already submitted for today', 409);
throw new AppError('OUTSIDE_CHECK_IN_WINDOW', 'Check-in window is closed', 400);
throw new AppError('LEADER_ALREADY_ASSIGNED', `Leader already assigned to "${team.name}"`, 409);
throw new AppError('INVALID_LEADER_ROLE', 'Team leader must have TEAM_LEAD role', 400);
throw new AppError('NOT_WORK_DAY', 'Today is not a scheduled work day', 400);
throw new AppError('HOLIDAY', 'Today is a company holiday', 400);
```

### Global Error Handler (app.ts)
```typescript
import { Hono } from 'hono';
import { AppError } from './shared/errors';
import { logger } from './config/logger';

const app = new Hono();

app.onError((err, c) => {
  // Known business errors - return structured response
  if (err instanceof AppError) {
    logger.warn({
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      path: c.req.path,
    });

    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      },
      err.statusCode as 400 | 401 | 403 | 404 | 409 | 500
    );
  }

  // Unexpected errors - log full stack, return generic message
  logger.error({
    error: err.message,
    stack: err.stack,
    path: c.req.path,
  });

  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
    500
  );
});
```

### Prisma Error Mapping
```typescript
import { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors';

// In service or repository methods that catch Prisma errors
try {
  return await prisma.$transaction(async (tx) => {
    // ... database operations
  });
} catch (error) {
  // P2002: Unique constraint violation
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new AppError('DUPLICATE_CHECK_IN', 'Check-in already submitted for today', 409);
  }

  // P2003: Foreign key constraint failure
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2003'
  ) {
    throw new AppError('INVALID_REFERENCE', 'Referenced entity does not exist', 400);
  }

  // P2025: Record not found (for update/delete operations)
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    throw new AppError('NOT_FOUND', 'Record not found', 404);
  }

  // Re-throw unknown errors (global handler catches them)
  throw error;
}
```

### Error Code Conventions

| Code | HTTP Status | When to Use |
|------|-------------|-------------|
| `NOT_FOUND` | 404 | Entity not found |
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `FORBIDDEN` | 403 | Authenticated but insufficient permissions |
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `CONFLICT` | 409 | Generic duplicate / state conflict |
| `DUPLICATE_CHECK_IN` | 409 | Already checked in today |
| `DUPLICATE_TEAM` | 409 | Team name already exists |
| `OUTSIDE_CHECK_IN_WINDOW` | 400 | Time-based eligibility failure |
| `NOT_WORK_DAY` | 400 | Schedule-based eligibility failure |
| `HOLIDAY` | 400 | Company holiday blocks operation |
| `INVALID_LEADER` | 400 | Leader not found or wrong role |
| `LEADER_ALREADY_ASSIGNED` | 409 | Leader already leads another team |
| `LEADER_REQUIRED` | 400 | Missing required leader assignment |
| `INTERNAL_ERROR` | 500 | Unexpected server error (generic message) |

### Error Response Format
```typescript
// All errors follow this format (enforced by global handler):
{
  success: false,
  error: {
    code: 'UPPER_SNAKE_CASE_CODE',
    message: 'Human-readable message for the user'
  }
}
```

## Rules
- ✅ DO use `AppError` for all business errors (not raw `Error`)
- ✅ DO use factory functions (`Errors.notFound`, `Errors.forbidden`) for standard HTTP errors
- ✅ DO use `new AppError(code, message, statusCode)` for domain-specific errors
- ✅ DO use UPPER_SNAKE_CASE for error codes
- ✅ DO write user-friendly error messages (these are shown to the user)
- ✅ DO map Prisma errors (P2002, P2003, P2025) to `AppError` in services
- ✅ DO re-throw unexpected errors (let global handler catch them)
- ✅ DO log `warn` level for expected `AppError`, `error` level for unexpected errors
- ❌ NEVER expose internal implementation details in error messages
- ❌ NEVER expose stack traces in production (global handler strips them)
- ❌ NEVER throw raw `Error` -- always use `AppError`
- ❌ NEVER catch errors in controller unless you need to transform them
- ❌ NEVER return error responses manually in controllers -- throw `AppError` and let global handler format

## Common Mistakes

### WRONG: Raw Error
```typescript
export async function getTeamById(c: Context): Promise<Response> {
  const team = await repository.findById(id);
  if (!team) {
    // WRONG - raw Error, not caught by global handler properly
    throw new Error('Team not found');
  }
  return c.json({ success: true, data: team });
}
```

### CORRECT: AppError
```typescript
export async function getTeamById(c: Context): Promise<Response> {
  const team = await repository.findById(id);
  if (!team) {
    // CORRECT - structured error with code and status
    throw new AppError('NOT_FOUND', 'Team not found', 404);
    // OR use factory: throw Errors.notFound('Team');
  }
  return c.json({ success: true, data: team });
}
```

### WRONG: Manual Error Response in Controller
```typescript
export async function createTeam(c: Context): Promise<Response> {
  const existing = await repository.findByName(data.name);
  if (existing) {
    // WRONG - manually formatting error response, bypasses global handler
    return c.json({
      success: false,
      error: { code: 'DUPLICATE', message: 'Team exists' },
    }, 409);
  }
}
```

### CORRECT: Throw AppError, Let Global Handler Format
```typescript
export async function createTeam(c: Context): Promise<Response> {
  const existing = await repository.findByName(data.name);
  if (existing) {
    // CORRECT - throw AppError, global handler returns { success: false, error: {...} }
    throw new AppError('DUPLICATE_TEAM', 'Team with this name already exists', 409);
  }
}
```

### WRONG: Exposing Internal Details
```typescript
throw new AppError(
  'DB_ERROR',
  `Prisma error P2002: Unique constraint on field person_id_check_in_date`,
  500
);
```

### CORRECT: User-Friendly Message
```typescript
throw new AppError(
  'DUPLICATE_CHECK_IN',
  'Check-in already submitted for today',
  409
);
```

### WRONG: Swallowing Unexpected Errors
```typescript
try {
  return await prisma.$transaction(async (tx) => { /* ... */ });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AppError('DUPLICATE', 'Already exists', 409);
  }
  // WRONG - swallowing unknown errors silently
  logger.error(error);
  return null;
}
```

### CORRECT: Re-throw Unknown Errors
```typescript
try {
  return await prisma.$transaction(async (tx) => { /* ... */ });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AppError('DUPLICATE', 'Already exists', 409);
  }
  // CORRECT - re-throw so global handler catches it
  throw error;
}
```


## Checklist

- [ ] Services contain business logic ONLY (no HTTP concerns)
- [ ] Services receive repositories via constructor (dependency injection)
- [ ] Services throw `AppError` for business rule violations
- [ ] Services use `prisma.$transaction` for atomic multi-step writes
- [ ] Services are stateless (no instance state beyond injected dependencies)
- [ ] Gets timezone from `c.get('companyTimezone')` in the controller
- [ ] Catches `Prisma.PrismaClientKnownRequestError` P2002 for unique constraints
- [ ] Uses timezone utilities from `shared/utils` for date/time operations
- [ ] Includes fire-and-forget `logAudit()` in the controller after service calls
- [ ] NEVER accesses Hono context in services
- [ ] NEVER imports Hono types in service files
