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
