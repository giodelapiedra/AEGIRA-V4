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

## 1. Routes (`<feature>.routes.ts`)

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { roleMiddleware } from '../../middleware/role';
import * as controller from './<feature>.controller';
import { listFeatureQuerySchema, featureIdParamSchema, createFeatureSchema, updateFeatureSchema } from './<feature>.validator';

const router = new Hono();

// ALWAYS apply auth + tenant on ALL routes
router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

// Role presets — define once, reuse across routes
const adminOnly = roleMiddleware(['ADMIN']);
const adminOrSupervisor = roleMiddleware(['ADMIN', 'SUPERVISOR']);

// IMPORTANT: Specific/named routes MUST come before dynamic /:id routes
// e.g., router.get('/me', controller.getMe);  ← BEFORE /:id

// Routes
router.get('/', adminOrSupervisor, zValidator('query', listFeatureQuerySchema), controller.list);
router.post('/', adminOnly, zValidator('json', createFeatureSchema), controller.create);
router.get('/:id', adminOrSupervisor, zValidator('param', featureIdParamSchema), controller.getById);
router.patch('/:id', adminOnly, zValidator('param', featureIdParamSchema), zValidator('json', updateFeatureSchema), controller.update);

export { router as featureRoutes };
```

**Middleware order:** `authMiddleware` → `tenantMiddleware` → `roleMiddleware` → `zValidator` → `controller`

## 2. Validator (`<feature>.validator.ts`)

```typescript
import { z } from 'zod';

// Query param validation for list endpoints
export const listFeatureQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().trim().optional(),
});

// Path param validation for :id routes
export const featureIdParamSchema = z.object({
  id: z.string().uuid('Invalid ID'),
});

export const createFeatureSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).trim(),
  email: z.string().email('Invalid email').toLowerCase().trim(),
  role: z.enum(['ADMIN', 'SUPERVISOR', 'TEAM_LEAD', 'WORKER']).default('WORKER'),
  teamId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
});

export const updateFeatureSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

// ALWAYS export inferred types
export type ListFeatureQuery = z.infer<typeof listFeatureQuerySchema>;
export type CreateFeatureInput = z.infer<typeof createFeatureSchema>;
export type UpdateFeatureInput = z.infer<typeof updateFeatureSchema>;
```

**Zod patterns:**
- `.trim()` on all string fields
- `.toLowerCase()` on email fields
- `.default()` for sensible defaults
- `.optional()` for non-required fields
- `.refine()` for cross-field validation

## 3. Repository (`<feature>.repository.ts`)

```typescript
import type { PrismaClient, Feature, Prisma } from '@prisma/client';
import { BaseRepository } from '../../shared/base.repository';
import { AppError } from '../../shared/errors';
import { calculateSkip, paginate } from '../../shared/utils';
import type { PaginationParams, PaginatedResponse } from '../../types/api.types';
import type { CreateFeatureInput, UpdateFeatureInput } from './<feature>.validator';

export class FeatureRepository extends BaseRepository {
  constructor(prisma: PrismaClient, companyId: string) {
    super(prisma, companyId);
  }

  async findAll(
    params: PaginationParams & { search?: string; includeInactive?: boolean }
  ): Promise<PaginatedResponse<Feature>> {
    const where: Prisma.FeatureWhereInput = {
      company_id: this.companyId,
      // Only show active by default
      ...(!params.includeInactive && { is_active: true }),
      ...(params.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' } },
        ],
      }),
    };

    // ALWAYS parallel query for items + count
    const [items, total] = await Promise.all([
      this.prisma.feature.findMany({
        where,
        skip: calculateSkip(params),
        take: params.limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.feature.count({ where }),
    ]);

    return paginate(items, total, params);
  }

  async findById(id: string): Promise<Feature | null> {
    return this.prisma.feature.findUnique({
      where: { id, company_id: this.companyId },
    });
  }

  async create(data: CreateFeatureInput): Promise<Feature> {
    try {
      return await this.prisma.feature.create({
        data: {
          company_id: this.companyId,
          // Map camelCase input → snake_case DB columns explicitly
          name: data.name,
          email: data.email,
          role: data.role,
          team_id: data.teamId,
          description: data.description,
        },
      });
    } catch (error) {
      // Handle FK constraint violations
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2003') {
        throw new AppError('INVALID_REFERENCE', 'Referenced entity does not exist', 400);
      }
      throw error;
    }
  }

  async update(id: string, data: UpdateFeatureInput): Promise<Feature> {
    return this.prisma.feature.update({
      where: { id, company_id: this.companyId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isActive !== undefined && { is_active: data.isActive }),
      },
    });
  }

  async deactivate(id: string): Promise<Feature> {
    return this.prisma.feature.update({
      where: { id, company_id: this.companyId },
      data: { is_active: false },
    });
  }
}
```

## 4. Controller (`<feature>.controller.ts`)

```typescript
import type { Context } from 'hono';
import type { AuthenticatedUser } from '../../types/api.types';
import { FeatureRepository } from './<feature>.repository';
import { Errors } from '../../shared/errors';
import { prisma } from '../../config/database';
import { logAudit } from '../../shared/audit';
import type { ListFeatureQuery } from './<feature>.validator';

function getRepository(companyId: string): FeatureRepository {
  return new FeatureRepository(prisma, companyId);
}

export async function list(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const { page, limit, search } = c.req.valid('query' as never) as ListFeatureQuery;
  const includeInactive = c.req.query('includeInactive') === 'true';

  const repository = getRepository(companyId);
  const result = await repository.findAll({ page, limit, search, includeInactive });

  return c.json({ success: true, data: result });
}

export async function create(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const data = c.req.valid('json'); // Typed from zValidator

  const repository = getRepository(companyId);
  const result = await repository.create(data);

  // Fire-and-forget audit log (no await — never blocks main operation)
  logAudit({
    companyId,
    personId: userId,
    action: 'CREATE_FEATURE',
    entityType: 'Feature',
    entityId: result.id,
    details: { name: result.name },
  });

  return c.json({ success: true, data: result }, 201);
}

export async function getById(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const { id } = c.req.valid('param' as never) as { id: string };

  const repository = getRepository(companyId);
  const result = await repository.findById(id);

  if (!result) {
    throw Errors.notFound('Feature');
  }

  return c.json({ success: true, data: result });
}

export async function update(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const { id } = c.req.valid('param' as never) as { id: string };
  const data = c.req.valid('json'); // Typed from zValidator

  const repository = getRepository(companyId);

  // Always check existence before update
  const existing = await repository.findById(id);
  if (!existing) {
    throw Errors.notFound('Feature');
  }

  const result = await repository.update(id, data);

  // Fire-and-forget audit log
  logAudit({
    companyId,
    personId: userId,
    action: 'UPDATE_FEATURE',
    entityType: 'Feature',
    entityId: id,
  });

  return c.json({ success: true, data: result });
}
```

## 5. Register Routes (app.ts)

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

## Key Rules

- ALWAYS extend `BaseRepository` for tenant isolation
- ALWAYS use `this.where()` for reads, `this.withCompany()` or explicit `company_id` for creates
- ALWAYS run `findMany` + `count` in parallel with `Promise.all`
- ALWAYS use `parsePagination()` from `shared/utils` for pagination params
- ALWAYS check existence before update/delete
- ALWAYS return `{ success: true, data: ... }` format (201 for creates, 200 for reads/updates)
- ALWAYS export inferred types from validators
- ALWAYS place specific routes before dynamic `/:id` routes
- ALWAYS use `findUnique` (not `findFirst`) for primary key lookups in repositories
- ALWAYS validate `:id` path params with `zValidator('param', idSchema)` (UUID format)
- ALWAYS validate list query params with `zValidator('query', querySchema)` (pagination + search)
- ALWAYS use `c.req.valid('query')` / `c.req.valid('param')` when route has `zValidator` — gives typed + validated input
- ALWAYS use `c.req.valid('json')` when route has `zValidator` — gives typed body
- ALWAYS map camelCase input fields to snake_case DB columns explicitly in repository `create`
- ALWAYS catch Prisma P2003 FK violations in repository and convert to `AppError`
- ALWAYS include fire-and-forget `logAudit()` calls in create/update/delete controllers (no await)
- ALWAYS extract `userId` from context for audit logging
- ALWAYS register new routes in app.ts after generating the module
- NEVER put business logic in controllers (use a service layer)
- NEVER hard delete records (use `is_active: false`)
- NEVER import Hono types in repositories or services
