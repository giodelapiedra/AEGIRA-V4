---
description: Repository Patterns for AEGIRA Backend (Prisma + Pagination)
globs: ["aegira-backend/src/modules/**/*.repository.ts"]
alwaysApply: false
---
# Repository Patterns

Repositories handle all database access. Every repository extends `BaseRepository` for multi-tenant isolation.

## Canonical Pattern

```typescript
import { BaseRepository } from '../../shared/base.repository';
import { calculateSkip, paginate } from '../../shared/utils';
import type { PaginationParams, PaginatedResponse } from '../../types/api.types';
import type { Prisma } from '@prisma/client';

export class FeatureRepository extends BaseRepository {

  // List with pagination - ALWAYS paginate, ALWAYS parallel count
  async findAll(
    params: PaginationParams & { search?: string }
  ): Promise<PaginatedResponse<Feature>> {
    const where: Prisma.FeatureWhereInput = {
      company_id: this.companyId,
      ...(params.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' } },
          { email: { contains: params.search, mode: 'insensitive' } },
        ],
      }),
    };

    // ALWAYS parallel query for items + total
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

  // Find by ID - ALWAYS filter by company_id
  async findById(id: string): Promise<Feature | null> {
    return this.prisma.feature.findFirst({
      where: this.where({ id }),
    });
  }

  // Create - ALWAYS use withCompany() for tenant isolation
  async create(data: CreateFeatureInput): Promise<Feature> {
    return this.prisma.feature.create({
      data: this.withCompany(data),
    });
  }

  // Update - ALWAYS verify company_id ownership
  async update(id: string, data: UpdateFeatureInput): Promise<Feature> {
    return this.prisma.feature.update({
      where: { id, company_id: this.companyId },
      data,
    });
  }

  // Soft delete - NEVER hard delete
  async deactivate(id: string): Promise<Feature> {
    return this.prisma.feature.update({
      where: { id, company_id: this.companyId },
      data: { is_active: false },
    });
  }
}
```

## Pagination Response Format

ALL list endpoints MUST return this exact format:

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 145,
      "totalPages": 8
    }
  }
}
```

## Rules

- ALWAYS extend `BaseRepository`
- ALWAYS use `this.where()` for reads and `this.withCompany()` for creates
- ALWAYS use `calculateSkip()` and `paginate()` from shared/utils
- ALWAYS run `count` in parallel with `findMany` using `Promise.all`
- ALWAYS paginate list queries (max 100 items)
- ALWAYS select only needed fields with `select` when returning large datasets
- ALWAYS use `include` to avoid N+1 queries
- NEVER hard delete records - use `is_active: false`
- NEVER use `findUnique` without company_id check (use `findFirst` with `this.where()`)
- Module path: `src/modules/<feature>/` → routes, controller, repository, validator, service (optional)
- Middleware chain: `authMiddleware` → `tenantMiddleware` → `roleMiddleware` → `zValidator` → `controller`
- Pagination: `parsePagination()` + `calculateSkip()` + `paginate()` from `shared/utils`
- Tenant isolation: extend `BaseRepository`, use `this.where()` for reads, `this.withCompany()` for creates
- Errors: `Errors.notFound()`, `Errors.forbidden()`, or `new AppError('CODE', 'message', status)`
- Response: `{ success: true, data: { ... } }`
- Specific routes BEFORE dynamic `/:id` routes
