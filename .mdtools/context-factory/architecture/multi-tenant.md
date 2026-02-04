---
description: Multi-Tenant Isolation Rules for AEGIRA
globs: ["aegira-backend/**/*.ts"]
alwaysApply: false
---
# Multi-Tenant Isolation

AEGIRA is a multi-tenant system. Every company's data MUST be completely isolated.

## Core Rule

**EVERY database query MUST filter by `company_id`.** No exceptions.

## BaseRepository Pattern

All repositories extend `BaseRepository` which enforces tenant isolation via two helpers:

```typescript
export abstract class BaseRepository {
  constructor(protected readonly prisma: PrismaClient, protected readonly companyId: string) {}

  // For READ queries - injects company_id into where clause
  protected where<T extends Record<string, unknown>>(conditions: T): T & { company_id: string } {
    return { ...conditions, company_id: this.companyId };
  }

  // For CREATE operations - injects company_id into data payload
  protected withCompany<T extends Record<string, unknown>>(data: T): T & { company_id: string } {
    return { ...data, company_id: this.companyId };
  }
}
```

- Use `this.where()` for all reads (`findFirst`, `findMany`, `count`)
- Use `this.withCompany()` for all creates (`create`)

## How company_id Flows

```
JWT Token → authMiddleware → c.set('companyId') → Controller → Repository(prisma, companyId)
```

1. User logs in, JWT contains `companyId`
2. `authMiddleware` validates JWT, sets `companyId` on Hono context
3. `tenantMiddleware` validates the company exists and is active
4. Controller reads `companyId` via `c.get('companyId')`
5. Controller passes `companyId` to Repository constructor
6. Repository uses `this.where()` to inject `company_id` in every query

## Rules

- NEVER trust client-provided company_id
- NEVER expose a company_id parameter in any public API endpoint
- ALWAYS extract company_id from the authenticated user's JWT
- ALWAYS use `this.where()` in repository read queries
- ALWAYS use `this.withCompany()` in repository create operations
- ALWAYS verify cross-entity references belong to the same company
- EVERY database query MUST filter by `company_id`
- NO `any` types — strict TypeScript
- Server state → TanStack Query, client state → Zustand (auth only)
- JWT in httpOnly cookie — no tokens in localStorage or Zustand
- Tailwind CSS only — no inline styles
- NEVER hard delete — use `is_active: false`

## Cross-Entity References

When linking entities (e.g., assigning a person to a team), verify both belong to the same company:

```typescript
async assignToTeam(personId: string, teamId: string): Promise<void> {
  const team = await this.prisma.team.findFirst({
    where: this.where({ id: teamId }),
  });
  if (!team) throw Errors.notFound('Team');

  await this.prisma.person.update({
    where: { id: personId, company_id: this.companyId },
    data: { team_id: teamId },
  });
}
```
