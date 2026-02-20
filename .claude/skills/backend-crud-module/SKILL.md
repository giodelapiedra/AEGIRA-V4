---
name: backend-crud-module
description: Generate a complete backend CRUD module for AEGIRA. Use when creating a new feature module with routes, controller, repository, and validator under aegira-backend/src/modules/.
---
# Backend CRUD Module

Generate all files for a new feature module under `aegira-backend/src/modules/<feature>/`.

## File Structure

```
src/modules/<feature>/
├── <feature>.routes.ts
├── <feature>.controller.ts
├── <feature>.repository.ts
└── <feature>.validator.ts
```

## Module Structure Pattern

<!-- BUILT FROM: .ai/patterns/backend/module-structure.md -->
# Module Structure
> Backend modules follow a 5-layer pattern: routes → controller → service → repository → validator

## When to Use
- Every backend feature module (auth, team, person, check-in, etc.)
- When creating new CRUD endpoints
- When building domain-specific business logic

## Layer Responsibilities

| Layer | Responsibility | Example |
|-------|---------------|---------|
| `routes.ts` | Route definitions, middleware application, validation hooks | `app.get('/teams', zValidator('query', listTeamsSchema), controller.list)` |
| `controller.ts` | Request parsing, response formatting, orchestration | Extract params, call service/repo, format response |
| `service.ts` | Complex business logic, multi-step operations, calculations | ReadinessScoreCalculator, multi-repo transactions |
| `repository.ts` | Database operations, query building, data access | Prisma queries with company_id filtering |
| `validator.ts` | Zod schemas, type exports, validation rules | `export const createTeamSchema = z.object({ ... })` |

## Canonical Implementation

### Directory Structure
```
src/modules/team/
├── team.routes.ts       # Route definitions
├── team.controller.ts   # Request handlers
├── team.service.ts      # Business logic (optional)
├── team.repository.ts   # Data access
└── team.validator.ts    # Zod schemas
```

### Route Registration Pattern
```typescript
// team.routes.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import * as controller from './team.controller.js';
import * as validators from './team.validator.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const teamRoutes = new Hono();

teamRoutes.use('*', requireAuth());

teamRoutes.get(
  '/',
  zValidator('query', validators.listTeamsSchema),
  controller.list
);

teamRoutes.get(
  '/:id',
  zValidator('param', validators.teamIdSchema),
  controller.getById
);

teamRoutes.post(
  '/',
  zValidator('json', validators.createTeamSchema),
  controller.create
);

teamRoutes.patch(
  '/:id',
  zValidator('param', validators.teamIdSchema),
  zValidator('json', validators.updateTeamSchema),
  controller.update
);

teamRoutes.delete(
  '/:id',
  zValidator('param', validators.teamIdSchema),
  controller.remove
);

export default teamRoutes;
```

### Controller Layer
```typescript
// team.controller.ts
import type { Context } from 'hono';
import { TeamRepository } from './team.repository.js';
import { parsePagination, paginate } from '../../shared/pagination.utils.js';
import type { CreateTeamInput, UpdateTeamInput } from './team.validator.js';

export async function list(c: Context) {
  const companyId = c.get('companyId') as string;
  const { page, limit } = parsePagination(c.req.query());
  const includeInactive = c.req.query('includeInactive') === 'true';

  const repo = new TeamRepository(c.get('prisma'), companyId);
  const { items, total } = await repo.findAll(page, limit, includeInactive);

  return c.json({
    success: true,
    data: paginate(items, page, limit, total),
  });
}

export async function getById(c: Context) {
  const companyId = c.get('companyId') as string;
  const { id } = c.req.valid('param');

  const repo = new TeamRepository(c.get('prisma'), companyId);
  const team = await repo.findById(id);

  return c.json({ success: true, data: team });
}

export async function create(c: Context) {
  const companyId = c.get('companyId') as string;
  const user = c.get('user');
  const body = c.req.valid('json') as CreateTeamInput;

  const repo = new TeamRepository(c.get('prisma'), companyId);
  const team = await repo.create(body);

  logAudit({
    companyId,
    personId: user.id,
    action: 'CREATE_TEAM',
    entityType: 'team',
    entityId: team.id,
  });

  return c.json({ success: true, data: team }, 201);
}
```

### Service Layer (Optional)
```typescript
// team.service.ts
import type { PrismaClient } from '@prisma/client';
import { TeamRepository } from './team.repository.js';
import { PersonRepository } from '../person/person.repository.js';

export class TeamService {
  constructor(
    private prisma: PrismaClient,
    private companyId: string
  ) {}

  async assignMembers(teamId: string, memberIds: string[]): Promise<void> {
    const teamRepo = new TeamRepository(this.prisma, this.companyId);
    const personRepo = new PersonRepository(this.prisma, this.companyId);

    // Complex multi-step operation
    await this.prisma.$transaction(async (tx) => {
      const team = await teamRepo.findById(teamId);
      const persons = await personRepo.findByIds(memberIds);

      // Business logic here...
      await tx.person.updateMany({
        where: { id: { in: memberIds } },
        data: { team_id: teamId },
      });
    });
  }
}
```

### Repository Layer
```typescript
// team.repository.ts
import type { PrismaClient, Team, Prisma } from '@prisma/client';
import { BaseRepository } from '../../shared/base-repository.js';
import { notFound } from '../../shared/errors.js';

export class TeamRepository extends BaseRepository {
  constructor(prisma: PrismaClient, companyId: string) {
    super(prisma, companyId);
  }

  async findAll(page: number, limit: number, includeInactive = false) {
    const where: Prisma.TeamWhereInput = this.where({
      ...(includeInactive ? {} : { is_active: true }),
    });

    const [items, total] = await Promise.all([
      this.prisma.team.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.team.count({ where }),
    ]);

    return { items, total };
  }

  async findById(id: string): Promise<Team> {
    const team = await this.prisma.team.findFirst({
      where: this.where({ id }),
    });

    if (!team) {
      throw notFound('Team not found');
    }

    return team;
  }

  async create(data: Prisma.TeamCreateInput): Promise<Team> {
    return this.prisma.team.create({
      data: { ...data, company_id: this.companyId },
    });
  }
}
```

### Validator Layer
```typescript
// team.validator.ts
import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

export const updateTeamSchema = createTeamSchema.partial();

export const teamIdSchema = z.object({
  id: z.string().uuid(),
});

export const listTeamsSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  includeInactive: z.string().optional(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
```

## Rules
- ✅ DO follow the 5-layer pattern for every module
- ✅ DO register routes with middleware and validation
- ✅ DO use `requireAuth()` middleware on protected routes
- ✅ DO export controller functions (not classes)
- ✅ DO add service layer only when needed (multi-repo, transactions, complex logic)
- ✅ DO extend `BaseRepository` for automatic company filtering
- ✅ DO export types from validator using `z.infer`
- ❌ NEVER skip validation on routes
- ❌ NEVER put business logic in controllers
- ❌ NEVER put Prisma queries in controllers
- ❌ NEVER create service classes for simple CRUD (use repository directly)

## Common Mistakes

### ❌ WRONG: Business Logic in Controller
```typescript
// team.controller.ts
export async function create(c: Context) {
  const companyId = c.get('companyId') as string;
  const body = c.req.valid('json');

  // ❌ Direct Prisma query in controller
  const team = await c.get('prisma').team.create({
    data: { ...body, company_id: companyId },
  });

  return c.json({ success: true, data: team });
}
```

### ✅ CORRECT: Repository for Data Access
```typescript
// team.controller.ts
export async function create(c: Context) {
  const companyId = c.get('companyId') as string;
  const body = c.req.valid('json') as CreateTeamInput;

  const repo = new TeamRepository(c.get('prisma'), companyId);
  const team = await repo.create(body);

  return c.json({ success: true, data: team }, 201);
}
```

### ❌ WRONG: Missing Validation
```typescript
// team.routes.ts
teamRoutes.post('/', controller.create); // ❌ No validation
```

### ✅ CORRECT: Validation Hook
```typescript
// team.routes.ts
teamRoutes.post(
  '/',
  zValidator('json', validators.createTeamSchema),
  controller.create
);
```

### ❌ WRONG: Service for Simple CRUD
```typescript
// Unnecessary service class for basic CRUD
export class TeamService {
  async findAll(page: number, limit: number) {
    const repo = new TeamRepository(this.prisma, this.companyId);
    return repo.findAll(page, limit); // ❌ Just proxying to repo
  }
}
```

### ✅ CORRECT: Use Repository Directly
```typescript
// team.controller.ts
export async function list(c: Context) {
  const companyId = c.get('companyId') as string;
  const { page, limit } = parsePagination(c.req.query());

  const repo = new TeamRepository(c.get('prisma'), companyId);
  const { items, total } = await repo.findAll(page, limit);

  return c.json({
    success: true,
    data: paginate(items, page, limit, total),
  });
}
```


## Routes Pattern

<!-- BUILT FROM: .ai/patterns/backend/routes-pattern.md -->
# Routes Pattern
> Hono route definitions with middleware stack - auth + tenant + role + validation

## When to Use
- Every backend module that exposes API endpoints
- When defining HTTP methods, paths, middleware chains, and controller handlers
- When applying role-based access control to routes
- When attaching request validation via `zValidator`

## Canonical Implementation

### Standard CRUD Module Routes
```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { roleMiddleware } from '../../middleware/role';
import * as controller from './person.controller';
import { createPersonSchema, updatePersonSchema, updateProfileSchema } from './person.validator';

const router = new Hono();

// Step 1: Apply auth + tenant middleware to ALL routes in this module
router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

// Step 2: Define role groups as reusable variables
const adminOnly = roleMiddleware(['ADMIN']);
const adminOrSupervisor = roleMiddleware(['ADMIN', 'SUPERVISOR']);
const adminSupervisorOrWhs = roleMiddleware(['ADMIN', 'SUPERVISOR', 'WHS']);

// Step 3: Define routes with middleware chain
// Pattern: router.METHOD(path, ...middleware, controller.handler)

// Self-service routes (any authenticated user)
router.get('/me', controller.getCurrentProfile);
router.patch('/me', zValidator('json', updateProfileSchema), controller.updateProfile);

// List and create (restricted roles)
router.get('/', adminSupervisorOrWhs, controller.listPersons);
router.post('/', adminOnly, zValidator('json', createPersonSchema), controller.createPerson);

// Detail and update (parameterized routes LAST)
router.get('/:id', adminSupervisorOrWhs, controller.getPersonById);
router.patch('/:id', adminOnly, zValidator('json', updatePersonSchema), controller.updatePerson);

// Step 4: Export with named export
export { router as personRoutes };
```

### Module With Mixed Role Requirements
```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { roleMiddleware } from '../../middleware/role';
import * as controller from './team.controller';
import * as missedCheckInController from '../missed-check-in/missed-check-in.controller';
import { createTeamSchema, updateTeamSchema } from './team.validator';
import { getMissedCheckInsQuerySchema, updateMissedCheckInSchema } from '../missed-check-in/missed-check-in.validator';

const router = new Hono();

router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

// Role groups
const adminOnly = roleMiddleware(['ADMIN']);
const teamLeadUp = roleMiddleware(['TEAM_LEAD', 'SUPERVISOR', 'ADMIN']);
const teamLeadUpOrWhs = roleMiddleware(['TEAM_LEAD', 'SUPERVISOR', 'ADMIN', 'WHS']);

// ADMIN-only management routes
router.get('/', adminOnly, controller.listTeams);
router.post('/', adminOnly, zValidator('json', createTeamSchema), controller.createTeam);

// IMPORTANT: Specific routes MUST come BEFORE parameterized routes
router.get('/missed-check-ins', teamLeadUpOrWhs,
  zValidator('query', getMissedCheckInsQuerySchema),
  missedCheckInController.getMissedCheckIns
);
router.patch('/missed-check-ins/:id', teamLeadUp,
  zValidator('json', updateMissedCheckInSchema),
  missedCheckInController.updateMissedCheckInStatus
);
router.get('/analytics', teamLeadUp, controller.getTeamAnalytics);
router.get('/check-in-history', teamLeadUpOrWhs, controller.getCheckInHistory);
router.get('/my-members', teamLeadUp, controller.getMyTeamMembers);

// Parameterized routes come AFTER specific routes
router.get('/:id', teamLeadUp, controller.getTeamById);
router.patch('/:id', adminOnly, zValidator('json', updateTeamSchema), controller.updateTeam);
router.get('/:id/members', teamLeadUp, controller.getTeamMembers);

export { router as teamRoutes };
```

### Admin Module (All Routes Same Role)
```typescript
const router = new Hono();

router.use('*', authMiddleware);
router.use('*', tenantMiddleware);
router.use('*', roleMiddleware(['ADMIN'])); // All routes require ADMIN

// Company Settings
router.get('/company/settings', controller.getCompanySettings);
router.patch('/company/settings', zValidator('json', updateSettingsSchema), controller.updateCompanySettings);

// Holidays (nested resource)
router.get('/holidays', controller.listHolidays);
router.post('/holidays', zValidator('json', createHolidaySchema), controller.createHoliday);
router.patch('/holidays/:id', zValidator('json', updateHolidaySchema), controller.updateHoliday);
router.delete('/holidays/:id', controller.deleteHoliday);

// Audit Logs
router.get('/audit-logs', controller.listAuditLogs);

export { router as adminRoutes };
```

### Module Without Role Restrictions (All Authenticated Users)
```typescript
const router = new Hono();

router.use('*', authMiddleware);
router.use('*', tenantMiddleware);
// No roleMiddleware - any authenticated user can access

router.post('/', zValidator('json', submitCheckInSchema), controller.submitCheckIn);
router.get('/today', controller.getTodayCheckIn);
router.get('/status', controller.getCheckInStatus);
router.get('/history', zValidator('query', getCheckInHistorySchema), controller.getCheckInHistory);
router.get('/:id', controller.getCheckInById);

export { router as checkInRoutes };
```

### Route Registration in app.ts
```typescript
// app.ts
import { Hono } from 'hono';
import { personRoutes } from './modules/person/person.routes';
import { teamRoutes } from './modules/team/team.routes';
import { checkInRoutes } from './modules/check-in/check-in.routes';

const app = new Hono();
const api = new Hono();

api.route('/persons', personRoutes);
api.route('/teams', teamRoutes);
api.route('/check-ins', checkInRoutes);

app.route('/api/v1', api);
```

### Common Role Groups Reference
| Group | Roles | Usage |
|-------|-------|-------|
| `adminOnly` | `['ADMIN']` | Management operations (create/update/delete entities) |
| `adminOrSupervisor` | `['ADMIN', 'SUPERVISOR']` | Viewing workers and teams |
| `teamLeadUp` | `['TEAM_LEAD', 'SUPERVISOR', 'ADMIN']` | Team-scoped operations |
| `teamLeadUpOrWhs` | `['TEAM_LEAD', 'SUPERVISOR', 'ADMIN', 'WHS']` | Team operations + WHS investigation |
| `whsUp` | `['WHS', 'SUPERVISOR', 'ADMIN']` | WHS and incident management |
| _(none)_ | All authenticated | Self-service (check-in, profile, notifications) |

## Rules
- ✅ DO apply `authMiddleware` + `tenantMiddleware` on ALL routes via `router.use('*')`
- ✅ DO define role groups as `const` variables for reuse
- ✅ DO use `zValidator('json', schema)` for body validation on `POST`/`PATCH`
- ✅ DO use `zValidator('query', schema)` for query parameter validation
- ✅ DO place specific routes BEFORE parameterized routes (`/analytics` before `/:id`)
- ✅ DO export with named export: `export { router as featureRoutes }`
- ✅ DO import controller as namespace: `import * as controller from './feature.controller'`
- ✅ DO import validators individually: `import { createSchema, updateSchema } from './feature.validator'`
- ❌ NEVER skip `authMiddleware` on protected routes
- ❌ NEVER skip `tenantMiddleware` (breaks multi-tenant isolation)
- ❌ NEVER skip validation on `POST`/`PATCH` routes
- ❌ NEVER put parameterized routes before specific routes (`:id` catches `/analytics`)
- ❌ NEVER use `default export` for routes (use named exports)
- ❌ NEVER apply role middleware to routes that should be accessible to all authenticated users

## Common Mistakes

### WRONG: Missing Auth/Tenant Middleware
```typescript
const router = new Hono();
// WRONG - no auth or tenant middleware
router.get('/', controller.listTeams);
router.post('/', controller.createTeam);
export { router as teamRoutes };
```

### CORRECT: Auth + Tenant on All Routes
```typescript
const router = new Hono();
router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

const adminOnly = roleMiddleware(['ADMIN']);
router.get('/', adminOnly, controller.listTeams);
router.post('/', adminOnly, zValidator('json', createTeamSchema), controller.createTeam);
export { router as teamRoutes };
```

### WRONG: Parameterized Route Before Specific Route
```typescript
const router = new Hono();
router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

// WRONG - /:id catches /analytics, /my-members, /check-in-history
router.get('/:id', controller.getTeamById);
router.get('/analytics', controller.getTeamAnalytics);    // Never reached
router.get('/my-members', controller.getMyTeamMembers);    // Never reached
```

### CORRECT: Specific Routes First
```typescript
const router = new Hono();
router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

// CORRECT - specific routes before parameterized
router.get('/analytics', teamLeadUp, controller.getTeamAnalytics);
router.get('/my-members', teamLeadUp, controller.getMyTeamMembers);
router.get('/:id', teamLeadUp, controller.getTeamById);
```

### WRONG: Missing Validation on Mutation
```typescript
// WRONG - no zValidator, raw unvalidated data reaches controller
router.post('/', adminOnly, controller.createTeam);
router.patch('/:id', adminOnly, controller.updateTeam);
```

### CORRECT: Validation Before Controller
```typescript
// CORRECT - input validated before controller executes
router.post('/', adminOnly, zValidator('json', createTeamSchema), controller.createTeam);
router.patch('/:id', adminOnly, zValidator('json', updateTeamSchema), controller.updateTeam);
```

### WRONG: Inline Role Arrays (Not Reusable)
```typescript
router.get('/', roleMiddleware(['TEAM_LEAD', 'SUPERVISOR', 'ADMIN']), controller.listTeams);
router.get('/analytics', roleMiddleware(['TEAM_LEAD', 'SUPERVISOR', 'ADMIN']), controller.getAnalytics);
router.get('/members', roleMiddleware(['TEAM_LEAD', 'SUPERVISOR', 'ADMIN']), controller.getMembers);
```

### CORRECT: Named Role Group Constants
```typescript
const teamLeadUp = roleMiddleware(['TEAM_LEAD', 'SUPERVISOR', 'ADMIN']);

router.get('/', teamLeadUp, controller.listTeams);
router.get('/analytics', teamLeadUp, controller.getAnalytics);
router.get('/members', teamLeadUp, controller.getMembers);
```


## Validator Pattern

<!-- BUILT FROM: .ai/patterns/backend/validation-pattern.md -->
# Validation Pattern
> Zod schemas for input validation with type exports - every route MUST have validation

## When to Use
- Every route that accepts request body (`POST`, `PATCH`)
- Every route with query parameters that need type safety
- Every route with path parameters (UUID validation)
- When defining TypeScript types for request data

## Canonical Implementation

### Create Schema (All Required Fields)
```typescript
import { z } from 'zod';

// Time format validation (HH:MM) - reusable across modules
const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

// Work days validation (CSV of 0-6, e.g., "1,2,3,4,5")
const workDaysRegex = /^[0-6](,[0-6])*$/;

export const createPersonSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  dateOfBirth: z.string().optional(),
  teamId: z.string().uuid().optional(),
  role: z.enum(['ADMIN', 'WHS', 'SUPERVISOR', 'TEAM_LEAD', 'WORKER']).default('WORKER'),
  workDays: z.string().regex(workDaysRegex, 'Invalid work days format').optional(),
  checkInStart: z.string().regex(timeRegex, 'Invalid time format (HH:MM)').optional(),
  checkInEnd: z.string().regex(timeRegex, 'Invalid time format (HH:MM)').optional(),
});

// ALWAYS export inferred types
export type CreatePersonInput = z.infer<typeof createPersonSchema>;
```

### Update Schema (Partial Fields)
```typescript
// Option 1: Manual partial (when update has different rules than create)
export const updatePersonSchema = z.object({
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName: z.string().min(1).max(100).trim().optional(),
  gender: z.enum(['MALE', 'FEMALE']).nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  workDays: z.string().regex(workDaysRegex).nullable().optional(),
  checkInStart: z.string().regex(timeRegex).nullable().optional(),
  checkInEnd: z.string().regex(timeRegex).nullable().optional(),
});

export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;

// Option 2: Derived partial (when update is simply all-optional create)
export const updateTeamSchema = createTeamSchema.partial();
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
```

### Schema with Cross-Field Validation (.refine)
```typescript
export const submitCheckInSchema = z.object({
  hoursSlept: z.number().min(0).max(24),
  sleepQuality: z.number().min(1).max(10),
  stressLevel: z.number().min(1).max(10),
  physicalCondition: z.number().min(1).max(10),
  painLevel: z.number().int().min(0).max(10).optional(),
  painLocation: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
}).refine(
  (data) => {
    // If pain level is above 0, pain location is required
    if (data.painLevel && data.painLevel > 0 && !data.painLocation?.trim()) {
      return false;
    }
    return true;
  },
  {
    message: 'Pain location is required when pain level is above 0',
    path: ['painLocation'],
  }
);

export type SubmitCheckInInput = z.infer<typeof submitCheckInSchema>;
```

### Schema with Paired-Field Validation
```typescript
export const createPersonSchema = z.object({
  // ... fields ...
  checkInStart: z.string().regex(timeRegex).optional(),
  checkInEnd: z.string().regex(timeRegex).optional(),
}).refine(
  (data) => {
    // If checkInStart is set, checkInEnd must also be set (and vice versa)
    if (data.checkInStart && !data.checkInEnd) return false;
    if (data.checkInEnd && !data.checkInStart) return false;
    return true;
  },
  {
    message: 'Both checkInStart and checkInEnd must be set together',
    path: ['checkInStart'],
  }
);
```

### Query Parameter Schema
```typescript
export const getCheckInHistorySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type GetCheckInHistoryInput = z.infer<typeof getCheckInHistorySchema>;
```

### Enum Filter Schema
```typescript
export const getMissedCheckInsQuerySchema = z.object({
  status: z.enum(['OPEN', 'INVESTIGATING', 'EXCUSED', 'RESOLVED']).optional(),
  workerId: z.string().optional(),
});

export type GetMissedCheckInsQuery = z.infer<typeof getMissedCheckInsQuerySchema>;
```

### Enum with Custom Error Messages
```typescript
export const updateUserRoleSchema = z.object({
  role: z.enum(['WORKER', 'TEAM_LEAD', 'SUPERVISOR', 'ADMIN'], {
    errorMap: () => ({ message: 'Role must be WORKER, TEAM_LEAD, SUPERVISOR, or ADMIN' }),
  }),
});

export type UpdateUserRoleData = z.infer<typeof updateUserRoleSchema>;
```

### Date String Schema
```typescript
export const createHolidaySchema = z.object({
  name: z.string().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recurring: z.boolean().optional().default(false),
});

export type CreateHolidayData = z.infer<typeof createHolidaySchema>;
```

### Restricted Update Schema (Subset of Fields)
```typescript
// Schema for users updating their OWN profile (limited fields)
export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName: z.string().min(1).max(100).trim().optional(),
  gender: z.enum(['MALE', 'FEMALE']).nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
```

### Validation Hook for Custom Error Format
```typescript
import type { Context } from 'hono';
import type { z } from 'zod';

// Use with zValidator to customize error response format
const validationHook = (
  result: { success: boolean; error?: z.ZodError },
  c: Context
) => {
  if (!result.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: result.error!.issues[0].message,
        },
      },
      400
    );
  }
};

// Usage in routes:
router.post('/', zValidator('json', schema, validationHook), controller.create);
```

## Rules
- ✅ DO export inferred types: `export type X = z.infer<typeof xSchema>`
- ✅ DO use `.partial()` for update schemas when all fields follow the same pattern
- ✅ DO use `.trim()` on string fields to strip whitespace
- ✅ DO use `.toLowerCase()` on email fields
- ✅ DO use `.default()` for fields with sensible defaults
- ✅ DO validate UUIDs with `.uuid()` for ID fields
- ✅ DO use `z.enum()` for fields with a fixed set of allowed values
- ✅ DO use `.refine()` for cross-field validation
- ✅ DO use `z.coerce.number()` or `z.coerce.date()` for query params (they arrive as strings)
- ✅ DO keep all schemas in `<feature>.validator.ts`
- ✅ DO use `.nullable().optional()` for update fields that can be cleared
- ❌ NEVER skip validation on routes -- every route MUST have `zValidator`
- ❌ NEVER use `any` for form data types -- always export `z.infer` types
- ❌ NEVER validate in the controller -- use `zValidator` middleware in routes
- ❌ NEVER duplicate validation logic between create and update schemas

## Common Mistakes

### WRONG: No Type Export
```typescript
export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});
// WRONG - no type export, controller must use `any` or inline type
```

### CORRECT: Export Inferred Type
```typescript
export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

// CORRECT - type exported for use in controller
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
```

### WRONG: Email Without Normalization
```typescript
export const createPersonSchema = z.object({
  email: z.string().email(), // WRONG - not trimmed or lowercased
  name: z.string(),          // WRONG - no min/max, not trimmed
});
```

### CORRECT: Normalized Email and Bounded Strings
```typescript
export const createPersonSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  name: z.string().min(1).max(100).trim(),
});
```

### WRONG: Hardcoded Query Params in Controller
```typescript
// check-in.controller.ts
export async function getHistory(c: Context): Promise<Response> {
  // WRONG - parsing and validating in controller
  const page = Number(c.req.query('page')) || 1;
  const limit = Math.min(Number(c.req.query('limit')) || 20, 100);
  const startDate = c.req.query('startDate') ? new Date(c.req.query('startDate')!) : undefined;
}
```

### CORRECT: Schema with Coercion for Query Params
```typescript
// check-in.validator.ts
export const getCheckInHistorySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

// check-in.routes.ts
router.get('/history', zValidator('query', getCheckInHistorySchema), controller.getHistory);
```

### WRONG: Separate Create and Update Schemas with Duplication
```typescript
export const createTeamSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  checkInStart: z.string().regex(timeRegex).optional(),
  checkInEnd: z.string().regex(timeRegex).optional(),
});

// WRONG - duplicating all fields instead of using partial()
export const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).optional(),
  checkInStart: z.string().regex(timeRegex).optional(),
  checkInEnd: z.string().regex(timeRegex).optional(),
});
```

### CORRECT: Derive Update from Create
```typescript
export const createTeamSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  checkInStart: z.string().regex(timeRegex).optional(),
  checkInEnd: z.string().regex(timeRegex).optional(),
});

// CORRECT - derive from create schema
export const updateTeamSchema = createTeamSchema.partial();

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
```


## Repository Pattern

<!-- BUILT FROM: .ai/patterns/backend/repository-pattern.md -->
# Repository Pattern
> Data access layer with BaseRepository for multi-tenant filtering and SAFE_SELECT for sensitive fields

## When to Use
- Every module that needs database operations
- When querying or mutating Prisma models
- When enforcing multi-tenant isolation (company_id filtering)
- When excluding sensitive fields from queries

## Canonical Implementation

### Basic Repository Structure
```typescript
import type { PrismaClient, Team, Prisma } from '@prisma/client';
import { BaseRepository } from '../../shared/base-repository.js';
import { notFound } from '../../shared/errors.js';

export class TeamRepository extends BaseRepository {
  constructor(prisma: PrismaClient, companyId: string) {
    super(prisma, companyId);
  }

  async findAll(
    page: number,
    limit: number,
    includeInactive = false
  ): Promise<{ items: Team[]; total: number }> {
    const where: Prisma.TeamWhereInput = this.where({
      ...(includeInactive ? {} : { is_active: true }),
    });

    const [items, total] = await Promise.all([
      this.prisma.team.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.team.count({ where }),
    ]);

    return { items, total };
  }

  async findById(id: string): Promise<Team> {
    const team = await this.prisma.team.findFirst({
      where: this.where({ id }),
    });

    if (!team) {
      throw notFound('Team not found');
    }

    return team;
  }

  async create(data: Omit<Prisma.TeamCreateInput, 'company_id'>): Promise<Team> {
    return this.prisma.team.create({
      data: {
        ...data,
        company_id: this.companyId,
      },
    });
  }

  async update(id: string, data: Prisma.TeamUpdateInput): Promise<Team> {
    const existing = await this.findById(id);

    return this.prisma.team.update({
      where: { id: existing.id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    const existing = await this.findById(id);

    await this.prisma.team.delete({
      where: { id: existing.id },
    });
  }
}
```

### BaseRepository Pattern
```typescript
// shared/base-repository.ts
import type { PrismaClient, Prisma } from '@prisma/client';

export class BaseRepository {
  protected prisma: PrismaClient;
  protected companyId: string;

  constructor(prisma: PrismaClient, companyId: string) {
    this.prisma = prisma;
    this.companyId = companyId;
  }

  /**
   * Helper to add company_id filter to WHERE clauses
   * Usage: this.where({ is_active: true })
   */
  protected where<T extends Record<string, unknown>>(
    conditions: T
  ): T & { company_id: string } {
    return { ...conditions, company_id: this.companyId };
  }
}
```

### SAFE_SELECT Pattern for Sensitive Fields
```typescript
// person.repository.ts
export const SAFE_PERSON_SELECT = {
  id: true,
  first_name: true,
  last_name: true,
  email: true,
  role: true,
  phone_number: true,
  team_id: true,
  is_active: true,
  created_at: true,
  updated_at: true,
  // ❌ Exclude: password_hash, reset_token, reset_token_expires
} as const;

export class PersonRepository extends BaseRepository {
  async findAll(page: number, limit: number) {
    const where = this.where({ is_active: true });

    const [items, total] = await Promise.all([
      this.prisma.person.findMany({
        where,
        select: SAFE_PERSON_SELECT, // ✅ Never return password
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { last_name: 'asc' },
      }),
      this.prisma.person.count({ where }),
    ]);

    return { items, total };
  }

  async findByEmail(email: string): Promise<Person | null> {
    return this.prisma.person.findFirst({
      where: this.where({ email }),
      // ✅ Return full model for auth checks (password_hash needed)
    });
  }
}
```

### Parallel Queries with Promise.all
```typescript
async findAll(page: number, limit: number): Promise<{ items: Team[]; total: number }> {
  const where: Prisma.TeamWhereInput = this.where({ is_active: true });

  // ✅ Run count and findMany in parallel for better performance
  const [items, total] = await Promise.all([
    this.prisma.team.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: 'asc' },
    }),
    this.prisma.team.count({ where }),
  ]);

  return { items, total };
}
```

### Complex Queries with Relations
```typescript
async findWithMembers(id: string): Promise<Team & { members: Person[] }> {
  const team = await this.prisma.team.findFirst({
    where: this.where({ id }),
    include: {
      members: {
        where: { is_active: true },
        select: SAFE_PERSON_SELECT,
        orderBy: { last_name: 'asc' },
      },
    },
  });

  if (!team) {
    throw notFound('Team not found');
  }

  return team;
}
```

### Search and Filter Pattern
```typescript
async search(
  query: string,
  filters: { teamId?: string; role?: string },
  page: number,
  limit: number
): Promise<{ items: Person[]; total: number }> {
  const where: Prisma.PersonWhereInput = this.where({
    is_active: true,
    ...(filters.teamId && { team_id: filters.teamId }),
    ...(filters.role && { role: filters.role }),
    ...(query && {
      OR: [
        { first_name: { contains: query, mode: 'insensitive' } },
        { last_name: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
      ],
    }),
  });

  const [items, total] = await Promise.all([
    this.prisma.person.findMany({
      where,
      select: SAFE_PERSON_SELECT,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { last_name: 'asc' },
    }),
    this.prisma.person.count({ where }),
  ]);

  return { items, total };
}
```

## Rules
- ✅ DO extend `BaseRepository` for all repositories
- ✅ DO use `this.where({ ... })` for all queries to enforce company_id filtering
- ✅ DO use `Promise.all` for parallel count + findMany queries
- ✅ DO define `SAFE_SELECT` constants for models with sensitive fields
- ✅ DO throw `notFound()` when entity doesn't exist
- ✅ DO add `company_id` in `create()` operations
- ✅ DO validate entity exists via `findById()` before `update()` or `delete()`
- ✅ DO use explicit `Prisma.*WhereInput` types for where clauses
- ❌ NEVER query without `this.where()` (breaks multi-tenancy)
- ❌ NEVER return password fields in list/detail endpoints
- ❌ NEVER use `findUnique` (doesn't support company_id filtering)
- ❌ NEVER await count and findMany sequentially
- ❌ NEVER catch errors in repository (let controller/service handle)

## Common Mistakes

### ❌ WRONG: Missing company_id Filter
```typescript
async findAll(page: number, limit: number) {
  // ❌ Missing company_id filter - returns data from ALL companies
  const items = await this.prisma.team.findMany({
    skip: (page - 1) * limit,
    take: limit,
  });

  return { items, total: items.length };
}
```

### ✅ CORRECT: Use this.where()
```typescript
async findAll(page: number, limit: number) {
  const where = this.where({ is_active: true });

  const [items, total] = await Promise.all([
    this.prisma.team.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
    }),
    this.prisma.team.count({ where }),
  ]);

  return { items, total };
}
```

### ❌ WRONG: Using findUnique
```typescript
async findById(id: string): Promise<Team> {
  // ❌ findUnique doesn't support company_id filtering
  const team = await this.prisma.team.findUnique({
    where: { id },
  });

  if (!team) throw notFound('Team not found');
  return team;
}
```

### ✅ CORRECT: Use findFirst with this.where()
```typescript
async findById(id: string): Promise<Team> {
  const team = await this.prisma.team.findFirst({
    where: this.where({ id }),
  });

  if (!team) {
    throw notFound('Team not found');
  }

  return team;
}
```

### ❌ WRONG: Sequential Queries
```typescript
async findAll(page: number, limit: number) {
  const where = this.where({ is_active: true });

  // ❌ Sequential - slow
  const items = await this.prisma.team.findMany({ where, skip: (page - 1) * limit, take: limit });
  const total = await this.prisma.team.count({ where });

  return { items, total };
}
```

### ✅ CORRECT: Parallel Queries
```typescript
async findAll(page: number, limit: number) {
  const where = this.where({ is_active: true });

  // ✅ Parallel - fast
  const [items, total] = await Promise.all([
    this.prisma.team.findMany({ where, skip: (page - 1) * limit, take: limit }),
    this.prisma.team.count({ where }),
  ]);

  return { items, total };
}
```

### ❌ WRONG: Exposing Sensitive Fields
```typescript
async findAll(page: number, limit: number) {
  const where = this.where({ is_active: true });

  const [items, total] = await Promise.all([
    // ❌ Returns password_hash, reset_token, etc.
    this.prisma.person.findMany({ where, skip: (page - 1) * limit, take: limit }),
    this.prisma.person.count({ where }),
  ]);

  return { items, total };
}
```

### ✅ CORRECT: Use SAFE_SELECT
```typescript
async findAll(page: number, limit: number) {
  const where = this.where({ is_active: true });

  const [items, total] = await Promise.all([
    this.prisma.person.findMany({
      where,
      select: SAFE_PERSON_SELECT, // ✅ Exclude sensitive fields
      skip: (page - 1) * limit,
      take: limit,
    }),
    this.prisma.person.count({ where }),
  ]);

  return { items, total };
}
```

### ❌ WRONG: Missing Existence Check
```typescript
async update(id: string, data: Prisma.TeamUpdateInput): Promise<Team> {
  // ❌ No check if team exists or belongs to company
  return this.prisma.team.update({
    where: { id },
    data,
  });
}
```

### ✅ CORRECT: Validate Before Update
```typescript
async update(id: string, data: Prisma.TeamUpdateInput): Promise<Team> {
  // ✅ Throws notFound if doesn't exist or wrong company
  const existing = await this.findById(id);

  return this.prisma.team.update({
    where: { id: existing.id },
    data,
  });
}
```


## Controller Pattern

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

### Validated Input Extraction (Zod Transforms)
```typescript
// CRITICAL: Use c.req.valid() instead of c.req.json() to ensure Zod transforms
// (trim, toLowerCase) are applied before the controller sees the data.
// The 'json' as never cast is a Hono generic Context workaround.

export async function createPerson(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;

  // CORRECT — Zod transforms applied (trim, toLowerCase on emails)
  const data = c.req.valid('json' as never) as CreatePersonInput;

  // WRONG — raw JSON, Zod transforms NOT applied
  // const data = await c.req.json() as CreatePersonInput;

  const repository = getRepository(companyId);
  const result = await repository.create(data);
  return c.json({ success: true, data: result }, 201);
}
```

### Create Controller (with Audit)
```typescript
export async function createPerson(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const data = c.req.valid('json' as never) as CreatePersonInput;

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
  const data = c.req.valid('json' as never) as UpdatePersonInput;

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
  const data = c.req.valid('json' as never) as CheckInInput;
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
- ✅ DO use `c.req.valid('json' as never) as InputType` for validated body — ensures Zod transforms apply
- ❌ NEVER use `c.req.json()` for validated endpoints — Zod transforms (trim, toLowerCase) won't apply
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
  const body = c.req.valid('json' as never) as CreateTeamInput;

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
  const body = c.req.valid('json' as never) as CreateTeamInput;

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


## Fire-and-Forget Audit

<!-- BUILT FROM: .ai/patterns/backend/fire-and-forget.md -->
# Fire-and-Forget Pattern
> Non-blocking side effects - audit logs and notifications NEVER block main operations

## When to Use
- Audit logging after create/update/delete operations
- Sending notifications to users (team assignments, alerts, reminders)
- Any non-critical side effect that should not delay the main response
- Background tasks that can fail silently without affecting the user

## Canonical Implementation

### logAudit - Fire-and-Forget Audit Logging
```typescript
// shared/audit.ts
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

interface AuditLogInput {
  companyId: string;
  personId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

/**
 * Create an audit log entry (non-blocking fire-and-forget).
 * Errors are logged but never thrown - audit failure must not break the main operation.
 */
export function logAudit(input: AuditLogInput): void {
  prisma.auditLog
    .create({
      data: {
        company_id: input.companyId,
        person_id: input.personId,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId || null,
        details: (input.details || {}) as Prisma.InputJsonValue,
      },
    })
    .catch((error: unknown) => {
      logger.error(
        { error, action: input.action, entityType: input.entityType },
        'Failed to create audit log'
      );
    });
}
```

### Usage in Controllers
```typescript
import { logAudit } from '../../shared/audit';

export async function createTeam(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const data = await c.req.json() as CreateTeamInput;

  const repository = getRepository(companyId);
  const result = await repository.create(data);

  // Fire-and-forget: NO await, NO try/catch needed
  logAudit({
    companyId,
    personId: userId,
    action: 'CREATE_TEAM',
    entityType: 'TEAM',
    entityId: result.id,
    details: { name: data.name, leaderId: data.leaderId },
  });

  return c.json({ success: true, data: result }, 201);
}

export async function updateCompanySettings(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const data = await c.req.json() as UpdateSettingsData;

  const repository = new AdminRepository(prisma, companyId);
  const company = await repository.updateCompany(data);

  // Fire-and-forget audit
  logAudit({
    companyId,
    personId: userId,
    action: 'UPDATE_SETTINGS',
    entityType: 'COMPANY',
    entityId: companyId,
    details: data as Record<string, unknown>,
  });

  return c.json({ success: true, data: company });
}

export async function deleteHoliday(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const id = c.req.param('id');

  const repository = new AdminRepository(prisma, companyId);
  const deleted = await repository.deleteHoliday(id);

  if (!deleted) {
    throw new AppError('NOT_FOUND', 'Holiday not found', 404);
  }

  // Fire-and-forget audit
  logAudit({
    companyId,
    personId: userId,
    action: 'DELETE_HOLIDAY',
    entityType: 'HOLIDAY',
    entityId: id,
  });

  return c.json({ success: true, data: { message: 'Holiday deleted' } });
}
```

### Fire-and-Forget Notification Helper
```typescript
import { NotificationRepository } from '../notification/notification.repository';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

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
    // Log error but don't throw - notification failure must not break main operation
    logger.error(
      { error, leaderId, teamName },
      'Failed to send team lead assignment notification'
    );
  }
}

// Called WITHOUT await from controller:
export async function createTeam(c: Context): Promise<Response> {
  // ... create team logic ...
  const result = await repository.create(data);

  // Both are fire-and-forget: no await
  notifyTeamLeadAssignment(companyId, data.leaderId, result.name);
  logAudit({
    companyId,
    personId: userId,
    action: 'CREATE_TEAM',
    entityType: 'TEAM',
    entityId: result.id,
    details: { name: data.name },
  });

  return c.json({ success: true, data: result }, 201);
}
```

### Pagination Utilities (Commonly Used Alongside)

These utilities are used in every list controller alongside fire-and-forget audit:

```typescript
// shared/utils.ts
import type { PaginationParams, PaginatedResponse } from '../types/api.types';

/**
 * Parses and clamps pagination query params.
 * Ensures page >= 1 and limit is between 1 and 100.
 */
export function parsePagination(
  pageParam?: string | null,
  limitParam?: string | null,
  defaultLimit = 20
): PaginationParams {
  return {
    page: clamp(Number(pageParam) || 1, 1, 10000),
    limit: clamp(Number(limitParam) || defaultLimit, 1, 100),
  };
}

/**
 * Calculates pagination skip value
 */
export function calculateSkip(params: PaginationParams): number {
  return (params.page - 1) * params.limit;
}

/**
 * Creates a paginated response
 */
export function paginate<T>(
  items: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  return {
    items,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  };
}
```

### Using parsePagination in List Controllers
```typescript
export async function listAuditLogs(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'), 50);
  const type = c.req.query('type');
  const search = c.req.query('search');

  const repository = new AdminRepository(prisma, companyId);
  const paginatedData = await repository.listAuditLogs(
    { page, limit },
    { type, search }
  );

  return c.json({ success: true, data: paginatedData });
}
```

### Using paginate in Repositories
```typescript
async findByPerson(
  personId: string,
  params: PaginationParams & { filter?: 'unread' | 'read' }
): Promise<PaginatedResponse<Notification>> {
  const where: Prisma.NotificationWhereInput = {
    company_id: this.companyId,
    person_id: personId,
    ...(params.filter === 'unread' && { read_at: null }),
  };

  const [items, total] = await Promise.all([
    this.prisma.notification.findMany({
      where,
      skip: calculateSkip(params),
      take: params.limit,
      orderBy: { created_at: 'desc' },
    }),
    this.prisma.notification.count({ where }),
  ]);

  return paginate(items, total, params);
}
```

### Notification Service (sendNotification / sendNotifications)
```typescript
import { sendNotification, sendNotifications } from '../../modules/notification/notification.service';

// Single notification — fire-and-forget, errors logged internally
sendNotification(prisma, companyId, {
  personId: leaderId,
  type: 'TEAM_ALERT',
  title: 'Team Leadership Assignment',
  message: `You have been assigned as the team lead of ${teamName}.`,
});

// Batch notifications — same pattern, accepts array
sendNotifications(prisma, companyId, [
  { personId: worker1Id, type: 'TEAM_ALERT', title: 'Team Update', message: '...' },
  { personId: worker2Id, type: 'TEAM_ALERT', title: 'Team Update', message: '...' },
]);
```

The notification service follows the same fire-and-forget contract as `logAudit()`:
- Returns `void` (not `Promise<void>` to callers)
- Internal `.catch()` with `logger.error` — never throws
- Safe to call without `await`
- Empty array input short-circuits (no DB call)

### Common Audit Action Codes

| Action | Entity Type | When |
|--------|-------------|------|
| `CREATE_TEAM` | `TEAM` | Team created |
| `UPDATE_TEAM` | `TEAM` | Team updated |
| `CREATE_PERSON` | `PERSON` | Person/worker created |
| `UPDATE_PERSON` | `PERSON` | Person/worker updated |
| `UPDATE_ROLE` | `PERSON` | User role changed |
| `UPDATE_SETTINGS` | `COMPANY` | Company settings modified |
| `CREATE_HOLIDAY` | `HOLIDAY` | Holiday added |
| `UPDATE_HOLIDAY` | `HOLIDAY` | Holiday modified |
| `DELETE_HOLIDAY` | `HOLIDAY` | Holiday removed |

## Rules
- ✅ DO call `logAudit()` without `await` -- it handles its own error catching internally
- ✅ DO use `.catch()` on Promise chains for fire-and-forget operations
- ✅ DO wrap notification helpers in `try/catch` with `logger.error` for failures
- ✅ DO call notification helpers without `await` in the controller
- ✅ DO use `parsePagination()` for all list endpoints
- ✅ DO use `calculateSkip()` and `paginate()` in repositories
- ✅ DO pass `details` to `logAudit` with relevant context (e.g., changed fields)
- ✅ DO make the return type `void` for fire-and-forget functions (not `Promise<void>` exposed to caller)
- ❌ NEVER `await` fire-and-forget operations in controllers
- ❌ NEVER let logging errors crash main operations
- ❌ NEVER let notification failures propagate to the client
- ❌ NEVER skip audit logging on state-changing operations (create/update/delete)
- ❌ NEVER block the HTTP response waiting for side effects to complete

## Common Mistakes

### WRONG: Awaiting Audit Log
```typescript
export async function createTeam(c: Context): Promise<Response> {
  const result = await repository.create(data);

  // WRONG - awaiting blocks the response
  await logAudit({
    companyId,
    personId: userId,
    action: 'CREATE_TEAM',
    entityType: 'TEAM',
    entityId: result.id,
  });

  return c.json({ success: true, data: result }, 201);
}
```

### CORRECT: Fire-and-Forget
```typescript
export async function createTeam(c: Context): Promise<Response> {
  const result = await repository.create(data);

  // CORRECT - no await, response returns immediately
  logAudit({
    companyId,
    personId: userId,
    action: 'CREATE_TEAM',
    entityType: 'TEAM',
    entityId: result.id,
  });

  return c.json({ success: true, data: result }, 201);
}
```

### WRONG: Notification Error Propagating to Client
```typescript
export async function createTeam(c: Context): Promise<Response> {
  const result = await repository.create(data);

  // WRONG - if notification fails, client gets 500 error
  const notificationRepo = new NotificationRepository(prisma, companyId);
  await notificationRepo.create({
    personId: data.leaderId,
    type: 'TEAM_ALERT',
    title: 'Assignment',
    message: `Assigned to ${result.name}`,
  });

  return c.json({ success: true, data: result }, 201);
}
```

### CORRECT: Wrapped in Try/Catch, No Await
```typescript
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
      title: 'Assignment',
      message: `Assigned to ${teamName}`,
    });
  } catch (error) {
    logger.error({ error, leaderId, teamName }, 'Failed to send notification');
  }
}

export async function createTeam(c: Context): Promise<Response> {
  const result = await repository.create(data);

  // CORRECT - helper handles its own errors, called without await
  notifyTeamLeadAssignment(companyId, data.leaderId, result.name);

  return c.json({ success: true, data: result }, 201);
}
```

### WRONG: Missing Audit on Delete
```typescript
export async function deleteHoliday(c: Context): Promise<Response> {
  const repository = new AdminRepository(prisma, companyId);
  await repository.deleteHoliday(id);
  // WRONG - no audit trail for deletion
  return c.json({ success: true, data: { message: 'Holiday deleted' } });
}
```

### CORRECT: Audit All State Changes
```typescript
export async function deleteHoliday(c: Context): Promise<Response> {
  const repository = new AdminRepository(prisma, companyId);
  const deleted = await repository.deleteHoliday(id);

  if (!deleted) {
    throw new AppError('NOT_FOUND', 'Holiday not found', 404);
  }

  // CORRECT - audit trail for all state-changing operations
  logAudit({
    companyId,
    personId: userId,
    action: 'DELETE_HOLIDAY',
    entityType: 'HOLIDAY',
    entityId: id,
  });

  return c.json({ success: true, data: { message: 'Holiday deleted' } });
}
```


## Register Routes

After generating the module, register the routes in the main app:

```typescript
// In src/app.ts (or wherever routes are mounted)
import { featureRoutes } from './modules/<feature>/<feature>.routes';

app.route('/features', featureRoutes);
```

## Context Variables Reference

Set by middleware, available in all controllers:

```typescript
const companyId = c.get('companyId') as string;       // From authMiddleware
const userId = c.get('userId') as string;             // From authMiddleware
const user = c.get('user') as AuthenticatedUser;      // From authMiddleware
const userRole = c.get('userRole') as string;         // From authMiddleware
const timezone = c.get('companyTimezone') as string;  // From tenantMiddleware
```

## Checklist

- [ ] Extends `BaseRepository` for tenant isolation
- [ ] Uses `this.where()` for reads, explicit `company_id` for creates
- [ ] Runs `findMany` + `count` in parallel with `Promise.all`
- [ ] Checks existence before update/delete
- [ ] Returns `{ success: true, data: ... }` format
- [ ] Exports inferred types from validators
- [ ] Places specific routes before dynamic `/:id` routes
- [ ] Uses `findFirst` with `this.where()` for primary key lookups (never `findUnique` — it doesn't support compound `company_id` filtering)
- [ ] Validates path params with `zValidator('param', idSchema)`
- [ ] Maps camelCase input to snake_case DB columns in create
- [ ] Includes fire-and-forget `logAudit()` in create/update/delete
- [ ] Registers new routes in app.ts
