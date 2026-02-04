---
description: Backend Feature Module Structure
globs: ["aegira-backend/src/modules/**/*.ts"]
alwaysApply: false
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
import { createFeatureSchema, updateFeatureSchema } from './<feature>.validator';

const router = new Hono();

// ALWAYS apply auth + tenant on ALL routes
router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

// Role presets
const adminOnly = roleMiddleware(['ADMIN']);
const adminOrSupervisor = roleMiddleware(['ADMIN', 'SUPERVISOR']);

// IMPORTANT: Specific routes MUST come before dynamic /:id routes
// e.g., router.get('/me', controller.getMe);  ← BEFORE /:id

// Routes
router.get('/', adminOrSupervisor, controller.list);
router.post('/', adminOnly, zValidator('json', createFeatureSchema), controller.create);
router.get('/:id', adminOrSupervisor, controller.getById);
router.patch('/:id', adminOnly, zValidator('json', updateFeatureSchema), controller.update);

export { router as featureRoutes };
```

**Middleware order:** `authMiddleware` → `tenantMiddleware` → `roleMiddleware` → `zValidator` → `controller`

## 2. Validator (`<feature>.validator.ts`)

```typescript
import { z } from 'zod';

export const createFeatureSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().toLowerCase().trim(),
  role: z.enum(['ADMIN', 'SUPERVISOR', 'TEAM_LEAD', 'WORKER']).default('WORKER'),
  teamId: z.string().uuid().optional(),
});

export const updateFeatureSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  isActive: z.boolean().optional(),
});

// ALWAYS export inferred types
export type CreateFeatureInput = z.infer<typeof createFeatureSchema>;
export type UpdateFeatureInput = z.infer<typeof updateFeatureSchema>;
```

## 3. Repository (`<feature>.repository.ts`)

```typescript
import { BaseRepository } from '../../shared/base.repository';
import { calculateSkip, paginate } from '../../shared/utils';
import type { PaginationParams, PaginatedResponse } from '../../types/api.types';
import type { Feature, Prisma } from '@prisma/client';

export class FeatureRepository extends BaseRepository {
  constructor(prisma: PrismaClient, companyId: string) {
    super(prisma, companyId);
  }

  async findAll(
    params: PaginationParams & { search?: string }
  ): Promise<PaginatedResponse<Feature>> {
    const where: Prisma.FeatureWhereInput = {
      company_id: this.companyId,
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
    return this.prisma.feature.findFirst({
      where: this.where({ id }),
    });
  }

  async create(data: CreateFeatureInput): Promise<Feature> {
    return this.prisma.feature.create({
      data: this.withCompany(data),
    });
  }

  async update(id: string, data: UpdateFeatureInput): Promise<Feature> {
    return this.prisma.feature.update({
      where: { id, company_id: this.companyId },
      data,
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
import { FeatureRepository } from './<feature>.repository';
import { AppError, Errors } from '../../shared/errors';
import { prisma } from '../../config/database';
import { parsePagination } from '../../shared/utils';

function getRepository(companyId: string): FeatureRepository {
  return new FeatureRepository(prisma, companyId);
}

export async function list(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'));
  const search = c.req.query('search')?.trim();

  const repository = getRepository(companyId);
  const result = await repository.findAll({ page, limit, search });

  return c.json({ success: true, data: result });
}

export async function create(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const data = await c.req.json();

  const repository = getRepository(companyId);
  const result = await repository.create(data);

  return c.json({ success: true, data: result }, 201);
}

export async function getById(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const id = c.req.param('id');

  const repository = getRepository(companyId);
  const result = await repository.findById(id);

  if (!result) {
    throw Errors.notFound('Feature');
  }

  return c.json({ success: true, data: result });
}

export async function update(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const id = c.req.param('id');
  const data = await c.req.json();

  const repository = getRepository(companyId);
  const existing = await repository.findById(id);
  if (!existing) {
    throw Errors.notFound('Feature');
  }

  const result = await repository.update(id, data);
  return c.json({ success: true, data: result });
}
```

## Key Rules

- ALWAYS extend `BaseRepository` for tenant isolation
- ALWAYS use `this.where()` for reads, `this.withCompany()` for creates
- ALWAYS run `findMany` + `count` in parallel with `Promise.all`
- ALWAYS use `parsePagination()` from `shared/utils` for pagination params
- ALWAYS check existence before update/delete
- ALWAYS return `{ success: true, data: ... }` format
- ALWAYS export inferred types from validators
- ALWAYS place specific routes before dynamic `/:id` routes
- NEVER put business logic in controllers (use a service layer)
- NEVER hard delete records (use `is_active: false`)
