# AEGIRA Backend - Claude Code Rules

## Directory Structure
```
src/
├── app.ts                           # Hono app + CORS + global error handler
├── index.ts                         # Server startup + scheduler init
├── config/
│   ├── env.ts                       # Zod environment validation
│   ├── database.ts                  # Prisma client singleton
│   └── logger.ts                    # Pino logger setup
├── middleware/
│   ├── auth.ts                      # JWT authentication (from cookie)
│   ├── role.ts                      # Role-based access control
│   ├── tenant.ts                    # Multi-tenant company validation
│   └── logger.ts                    # Request/response logging
├── shared/
│   ├── base.repository.ts           # BaseRepository (tenant isolation)
│   ├── errors.ts                    # AppError class + factory functions
│   ├── utils.ts                     # Timezone, pagination, date utilities
│   ├── password.ts                  # bcrypt hashing (12 rounds)
│   ├── audit.ts                     # Fire-and-forget audit logging
│   ├── storage.ts                   # Cloudflare R2 file operations
│   ├── holiday.utils.ts             # Holiday checking logic
│   └── team-context.ts              # Team access control helper
├── types/
│   ├── api.types.ts                 # API response/request types
│   └── domain.types.ts              # Business logic types + Prisma enum re-exports
├── modules/
│   └── <feature>/
│       ├── <feature>.routes.ts      # Route definitions + middleware chain
│       ├── <feature>.controller.ts  # Request handling + response formatting
│       ├── <feature>.service.ts     # Business logic (optional, for complex modules)
│       ├── <feature>.repository.ts  # Database queries (extends BaseRepository)
│       └── <feature>.validator.ts   # Zod schemas + exported inferred types
├── jobs/
│   ├── scheduler.ts                 # Cron job initialization
│   ├── missed-check-in-detector.ts  # Missed check-in detection
│   └── cleanup.ts                   # Weekly cleanup
└── prisma/
    └── schema.prisma                # Database schema
```

## Before Writing Code
1. Check `shared/` for existing utilities (pagination, errors, timezone, team context, storage, audit)
2. Check `middleware/` for existing middleware (auth, tenant, role, logger)
3. Check `types/` for existing type definitions
4. Follow `src/modules/person/` as the reference CRUD module
5. Follow `src/modules/check-in/` as the reference for complex modules with services

---

## Module Structure

Every feature module follows this layer pattern:

```
Request → Routes (middleware chain) → Controller → Service (optional) → Repository → Prisma → Database
Response ← Controller (JSON wrapper) ← Service ← Repository
```

- **Routes**: Define endpoints, attach middleware (auth, tenant, role, validation)
- **Controller**: Extract request data, call repository/service, return formatted JSON
- **Service**: Complex business logic, multi-step operations, calculations (only when needed)
- **Repository**: Database queries, extends BaseRepository for tenant isolation
- **Validator**: Zod schemas for request body validation

### When to add a Service layer
- Simple CRUD (person, team): Controller → Repository directly
- Complex logic (check-in with readiness calculation, eligibility checks): Controller → Service → Repository

---

## Multi-Tenant Isolation (CRITICAL)

Every query MUST be scoped by `company_id`. Use `BaseRepository` to enforce this.

### BaseRepository Pattern
```typescript
import { BaseRepository } from '../../shared/base.repository';

export class PersonRepository extends BaseRepository {
  // this.where() adds company_id to WHERE clause
  async findById(id: string) {
    return this.prisma.person.findFirst({
      where: this.where({ id }),
    });
  }

  // this.withCompany() adds company_id to data for INSERT
  async create(data: CreatePersonData) {
    return this.prisma.person.create({
      data: this.withCompany({
        email: data.email,
        first_name: data.firstName,
        // ...
      }),
    });
  }

  // UPDATE must also scope by company_id
  async update(id: string, data: UpdatePersonData) {
    return this.prisma.person.update({
      where: { id, company_id: this.companyId },
      data: { /* ... */ },
    });
  }
}
```

### Rules
- ALWAYS extend `BaseRepository` for all repositories
- ALWAYS use `this.where()` for reads — adds `company_id` filter
- ALWAYS use `this.withCompany()` for creates — adds `company_id` to data
- ALWAYS include `company_id` in UPDATE where clauses
- NEVER trust client-provided company_id — always use `c.get('companyId')` from auth middleware

---

## Controller Pattern

```typescript
import type { Context } from 'hono';
import { PersonRepository } from './person.repository';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/errors';
import { parsePagination } from '../../shared/utils';
import { logAudit } from '../../shared/audit';
import type { AuthenticatedUser } from '../../types/api.types';

// Helper to create repository with tenant scope
function getRepository(companyId: string): PersonRepository {
  return new PersonRepository(prisma, companyId);
}

export async function listPersons(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'));

  const repository = getRepository(companyId);
  const result = await repository.findAll({ page, limit });

  return c.json({ success: true, data: result });
}

export async function createPerson(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const data = await c.req.json();

  const repository = getRepository(companyId);
  const result = await repository.create(data);

  // Audit (non-blocking — never await, never throw)
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

### Rules
- Extract `companyId` from `c.get('companyId')`, NEVER from request body
- Extract `userId` from `c.get('userId')` for audit trails
- Use `parsePagination()` for all list endpoints
- Return `{ success: true, data }` for all success responses
- Use HTTP 201 for creates, 200 for reads/updates/deletes
- Audit logs and notifications are fire-and-forget — never `await`, errors logged but never thrown

---

## Route Definition Pattern

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { roleMiddleware } from '../../middleware/role';
import { createPersonSchema, updatePersonSchema } from './person.validator';
import * as controller from './person.controller';

const router = new Hono();

// Apply auth + tenant middleware to ALL routes in this module
router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

// Role middleware as constant for reuse
const adminOnly = roleMiddleware(['ADMIN']);
const supervisorUp = roleMiddleware(['ADMIN', 'SUPERVISOR']);

// Routes: validation middleware BEFORE controller
router.get('/', supervisorUp, controller.listPersons);
router.post('/', adminOnly, zValidator('json', createPersonSchema), controller.createPerson);
router.get('/:id', controller.getPersonById);
router.patch('/:id', adminOnly, zValidator('json', updatePersonSchema), controller.updatePerson);

export { router as personRoutes };
```

### Rules
- ALWAYS apply `authMiddleware` + `tenantMiddleware` on all routes (via `router.use('*')`)
- Use `roleMiddleware(['ROLE1', 'ROLE2'])` for role-restricted endpoints
- Validation middleware (`zValidator`) goes BEFORE the controller
- Export router with named export: `export { router as featureRoutes }`

---

## Validation Pattern (Zod)

```typescript
import { z } from 'zod';

export const createPersonSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['WORKER', 'TEAM_LEAD', 'SUPERVISOR', 'ADMIN']).default('WORKER'),
  teamId: z.string().uuid().optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  dateOfBirth: z.string().optional(),
});

// ALWAYS export inferred types
export type CreatePersonInput = z.infer<typeof createPersonSchema>;

// Update schemas: same structure but all fields optional
export const updatePersonSchema = createPersonSchema.partial().omit({ password: true });
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
```

### Validation Hook for Custom Error Format
```typescript
import type { ValidationTargets } from 'hono';

// Use with zValidator to customize error response format
const validationHook = (result: { success: boolean; error?: z.ZodError }, c: Context) => {
  if (!result.success) {
    return c.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: result.error!.issues[0].message,
      },
    }, 400);
  }
};

// Usage in routes:
router.post('/', zValidator('json', schema, validationHook), controller.create);
```

### Rules
- Zod schemas live in `<feature>.validator.ts`
- ALWAYS export inferred types: `export type X = z.infer<typeof xSchema>`
- Use `.trim()` on string fields
- Use `.toLowerCase()` on email fields
- Use `.default()` for fields with sensible defaults
- Apply via `zValidator('json', schema)` in routes, not in controller

---

## Error Handling Pattern

### AppError Class
```typescript
import { AppError } from '../../shared/errors';

// Factory functions for common errors
throw Errors.notFound('Person');            // 404: "Person not found"
throw Errors.unauthorized('Invalid token'); // 401
throw Errors.forbidden('Access denied');    // 403
throw Errors.conflict('Email exists');      // 409
throw Errors.validation('Invalid input');   // 400

// Custom error with specific code
throw new AppError('DUPLICATE_CHECK_IN', 'You already checked in today', 409);
throw new AppError('OUTSIDE_CHECK_IN_WINDOW', 'Check-in window is closed', 400);
```

### Rules
- NEVER throw raw `Error` — always use `AppError`
- NEVER catch errors in controller unless you need to transform them — let global handler catch
- Use semantic error codes in UPPER_SNAKE_CASE
- The global error handler in `app.ts` catches all `AppError` instances and returns `{ success: false, error: { code, message } }`
- Unexpected errors return generic 500 without exposing internals

---

## Pagination Pattern

### In Repository (parallel count + findMany)
```typescript
async findAll(params: { page: number; limit: number }) {
  const skip = calculateSkip(params);

  // ALWAYS run count and findMany in parallel
  const [items, total] = await Promise.all([
    this.prisma.person.findMany({
      where: this.where({ is_active: true }),
      skip,
      take: params.limit,
      orderBy: { created_at: 'desc' },
    }),
    this.prisma.person.count({
      where: this.where({ is_active: true }),
    }),
  ]);

  return paginate(items, total, params);
}
```

### Rules
- ALWAYS paginate list endpoints — never return unbounded arrays
- ALWAYS run `findMany` + `count` in parallel with `Promise.all()`
- Use `calculateSkip()` and `paginate()` from `shared/utils.ts`
- Response format: `{ items: T[], pagination: { page, limit, total, totalPages } }`
- Default limit: 20, max limit: 100 (enforced by `parsePagination`)

---

## Fire-and-Forget Pattern

For non-critical operations (audit logs, notifications) that should never block the main operation:

```typescript
// Audit logging — never await, never throw
logAudit({
  companyId,
  personId: userId,
  action: 'CREATE_PERSON',
  entityType: 'PERSON',
  entityId: result.id,
  details: { email: data.email },
});

// Notifications — call without await, wrap in try/catch internally
notifyWorkerTeamAssignment(companyId, personId, teamId, true);
```

### Rules
- NEVER `await` fire-and-forget operations
- Fire-and-forget functions MUST have internal try/catch — errors are logged but never thrown
- Used for: `logAudit()`, notification creation, non-critical side effects
- Main operation MUST succeed even if fire-and-forget fails

---

## Response Format

### All Endpoints
```typescript
// Success
return c.json({ success: true, data: result });
return c.json({ success: true, data: result }, 201);  // For creates

// Paginated
return c.json({ success: true, data: { items, pagination } });

// Error (handled by global error handler via AppError)
{ success: false, error: { code: 'ERROR_CODE', message: 'User message' } }
```

---

## Middleware Context Variables

After auth + tenant middleware, these are available on all requests:

| Variable | Type | Source | Usage |
|----------|------|--------|-------|
| `c.get('user')` | `AuthenticatedUser` | Auth middleware | Full user object |
| `c.get('userId')` | `string` | Auth middleware | Current user ID |
| `c.get('companyId')` | `string` | Auth middleware | Current company ID |
| `c.get('userRole')` | `string` | Auth middleware | Current user role |

---

## Database Column Naming
- Prisma schema uses `snake_case` for all columns
- TypeScript code uses `camelCase` for variables
- Repository maps between the two when creating/updating records:
  ```typescript
  // camelCase input → snake_case DB columns
  data: this.withCompany({
    first_name: input.firstName,
    last_name: input.lastName,
    password_hash: hashedPassword,
  })
  ```

---

## TypeScript Rules
- NO `any` types
- Explicit return types on all exported functions: `Promise<Response>`
- Strict mode enabled
- Use `interface` for object shapes, `type` for unions/primitives
- Use `as string` for context getters: `c.get('companyId') as string`
- Import types with `import type` when only used for type annotations
