---
description: Hono Route Patterns for AEGIRA Backend
globs: ["aegira-backend/src/modules/**/*.routes.ts"]
alwaysApply: false
---
# Route Patterns

Routes define the HTTP interface for each module. They wire middleware, validation, and controllers together.

## Canonical Pattern

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { roleMiddleware } from '../../middleware/role';
import * as controller from './<feature>.controller';
import { createSchema, updateSchema } from './<feature>.validator';

const router = new Hono();

// ALWAYS apply auth + tenant on ALL routes
router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

// Role middleware factories
const adminOnly = roleMiddleware(['ADMIN']);
const teamLeadUp = roleMiddleware(['TEAM_LEAD', 'SUPERVISOR', 'ADMIN']);

// Routes: method, path, [role middleware], [validation], controller
router.get('/', adminOnly, controller.list);
router.post('/', adminOnly, zValidator('json', createSchema), controller.create);
router.get('/:id', adminOnly, controller.getById);
router.patch('/:id', adminOnly, zValidator('json', updateSchema), controller.update);

export { router as featureRoutes };
```

## Middleware Order

```
authMiddleware → tenantMiddleware → roleMiddleware → zValidator → controller
```

1. **authMiddleware** - Validates JWT, sets `user`, `companyId`, `userId`, `userRole` on context
2. **tenantMiddleware** - Validates the company exists and is active
3. **roleMiddleware** - Checks user role against allowed roles
4. **zValidator** - Validates request body/params/query with Zod schema

## Role Middleware Presets

```typescript
const adminOnly   = roleMiddleware(['ADMIN']);
const supervisorUp = roleMiddleware(['SUPERVISOR', 'ADMIN']);
const teamLeadUp  = roleMiddleware(['TEAM_LEAD', 'SUPERVISOR', 'ADMIN']);
const allRoles    = roleMiddleware(['WORKER', 'TEAM_LEAD', 'SUPERVISOR', 'ADMIN']);
```

## Rules

- ALWAYS apply `authMiddleware` and `tenantMiddleware` on all routes
- ALWAYS apply role middleware before validation
- ALWAYS use `zValidator` for request body validation on POST/PATCH
- ALWAYS use `controller.*` functions (never inline logic in routes)
- Export the router with a descriptive name: `featureRoutes`
- Module path: `src/modules/<feature>/` → routes, controller, repository, validator, service (optional)
- Middleware chain: `authMiddleware` → `tenantMiddleware` → `roleMiddleware` → `zValidator` → `controller`
- Pagination: `parsePagination()` + `calculateSkip()` + `paginate()` from `shared/utils`
- Tenant isolation: extend `BaseRepository`, use `this.where()` for reads, `this.withCompany()` for creates
- Errors: `Errors.notFound()`, `Errors.forbidden()`, or `new AppError('CODE', 'message', status)`
- Response: `{ success: true, data: { ... } }`
- Specific routes BEFORE dynamic `/:id` routes
