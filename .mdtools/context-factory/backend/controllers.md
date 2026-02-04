---
description: Controller Patterns for AEGIRA Backend
globs: ["aegira-backend/src/modules/**/*.controller.ts"]
alwaysApply: false
---
# Controller Patterns

Controllers handle HTTP request/response. They parse inputs, call service/repository, and return formatted responses.

## Canonical CRUD Controller

```typescript
import type { Context } from 'hono';
import { FeatureRepository } from './<feature>.repository';
import { AppError, Errors } from '../../shared/errors';
import { prisma } from '../../config/database';

function getRepository(companyId: string): FeatureRepository {
  return new FeatureRepository(prisma, companyId);
}

// List with pagination - ALWAYS paginate
export async function list(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const page = Number(c.req.query('page') ?? 1);
  const limit = Number(c.req.query('limit') ?? 20);
  const search = c.req.query('search')?.trim();

  const repository = getRepository(companyId);
  const result = await repository.findAll({ page, limit, search });

  return c.json({ success: true, data: result });
}

// Create
export async function create(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const data = c.req.valid('json');

  const repository = getRepository(companyId);
  const result = await repository.create(data);

  return c.json({ success: true, data: result }, 201);
}

// Get by ID
export async function getById(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const id = c.req.param('id');

  const repository = getRepository(companyId);
  const result = await repository.findById(id);

  if (!result) {
    throw Errors.notFound('Resource');
  }

  return c.json({ success: true, data: result });
}

// Update
export async function update(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const id = c.req.param('id');
  const data = c.req.valid('json');

  const repository = getRepository(companyId);
  const existing = await repository.findById(id);
  if (!existing) {
    throw Errors.notFound('Resource');
  }

  const result = await repository.update(id, data);
  return c.json({ success: true, data: result });
}
```

## Context Values (from Middleware)

After auth middleware, these are available via `c.get()`:

```typescript
const user = c.get('user') as AuthenticatedUser;   // { id, email, companyId, role }
const companyId = c.get('companyId') as string;
const userId = c.get('userId') as string;
const userRole = c.get('userRole') as string;
```

## Response Format

```typescript
// Success
return c.json({ success: true, data: result });
return c.json({ success: true, data: result }, 201);  // Created

// Error (thrown, caught by error middleware)
throw Errors.notFound('Person');
throw Errors.forbidden('Access denied');
throw new AppError('CUSTOM_CODE', 'Custom message', 400);
```

## Controller with Service Layer

When business logic is involved, controllers instantiate a service:

```typescript
async function getService(companyId: string): Promise<CheckInService> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  const repository = new CheckInRepository(prisma, companyId);
  return new CheckInService(repository, company?.timezone ?? 'Asia/Manila');
}

export async function submitCheckIn(c: Context): Promise<Response> {
  const data = c.req.valid('json');
  const user = c.get('user') as AuthenticatedUser;
  const companyId = c.get('companyId') as string;

  const service = await getService(companyId);
  const result = await service.submit(data, user.id, companyId);

  return c.json({ success: true, data: result }, 201);
}
```

## Rules

- Use `c.req.valid('json')` when zValidator is applied on the route
- Use `c.req.json()` with manual casting when validation is handled elsewhere
- ALWAYS instantiate repository with `companyId` from context
- ALWAYS check existence before update/delete
- ALWAYS return `{ success: true, data: ... }` format
- ALWAYS use `Errors.*` factory or `AppError` for errors
- NEVER put business logic in controllers (use service layer)
- NEVER return raw Prisma errors to client
- Module path: `src/modules/<feature>/` → routes, controller, repository, validator, service (optional)
- Middleware chain: `authMiddleware` → `tenantMiddleware` → `roleMiddleware` → `zValidator` → `controller`
- Pagination: `parsePagination()` + `calculateSkip()` + `paginate()` from `shared/utils`
- Tenant isolation: extend `BaseRepository`, use `this.where()` for reads, `this.withCompany()` for creates
- Errors: `Errors.notFound()`, `Errors.forbidden()`, or `new AppError('CODE', 'message', status)`
- Response: `{ success: true, data: { ... } }`
- Specific routes BEFORE dynamic `/:id` routes
