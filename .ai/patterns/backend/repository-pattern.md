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
