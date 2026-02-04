---
description: Service Layer Patterns for AEGIRA Backend
globs: ["aegira-backend/src/modules/**/*.service.ts"]
alwaysApply: false
---
# Backend Service Layer

Add a service when the feature needs business logic beyond simple CRUD. Services sit between controllers and repositories.

## When to Use

- Multiple repository calls need coordination
- Complex business rules or eligibility checks
- Prisma `$transaction` for atomic multi-step writes
- Data transformation before/after database access
- Cross-module operations

For simple CRUD with no business logic, controllers call repositories directly.

## File Location

```
src/modules/<feature>/<feature>.service.ts
```

## Service Pattern

```typescript
import { Prisma, type Feature } from '@prisma/client';
import { FeatureRepository } from './<feature>.repository';
import { AppError } from '../../shared/errors';
import { prisma } from '../../config/database';

export class FeatureService {
  constructor(
    private readonly repository: FeatureRepository,
    private readonly timezone: string = 'Asia/Manila'
  ) {}

  async submit(
    input: CreateFeatureInput,
    personId: string,
    companyId: string
  ): Promise<Feature> {
    // 1. Business rule validation
    const existing = await this.repository.findByDate(personId, today);
    if (existing) {
      throw new AppError('DUPLICATE_ENTRY', 'Already submitted for today', 409);
    }

    // 2. Event-sourced transaction (event + record atomically)
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Create event first (event sourcing)
        const event = await tx.event.create({
          data: {
            company_id: companyId,
            person_id: personId,
            event_type: 'FEATURE_SUBMITTED',
            entity_type: 'feature',
            payload: { ...input },
          },
        });

        // Create the actual record
        return tx.feature.create({
          data: {
            company_id: companyId,
            person_id: personId,
            event_id: event.id,
            // ... mapped fields
          },
        });
      });

      return result;
    } catch (error) {
      // Catch unique constraint violations for friendly errors
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppError('DUPLICATE_ENTRY', 'Already submitted for today', 409);
      }
      throw error;
    }
  }
}
```

## Controller Integration

```typescript
// In <feature>.controller.ts
async function getService(companyId: string): Promise<FeatureService> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  const repository = new FeatureRepository(prisma, companyId);
  return new FeatureService(repository, company?.timezone ?? 'Asia/Manila');
}

export async function submit(c: Context): Promise<Response> {
  const data = c.req.valid('json');
  const user = c.get('user') as AuthenticatedUser;
  const companyId = c.get('companyId') as string;

  const service = await getService(companyId);
  const result = await service.submit(data, user.id, companyId);

  return c.json({ success: true, data: result }, 201);
}
```

## Key Rules

- Services contain business logic ONLY (no HTTP concerns)
- Services receive repositories via constructor (dependency injection)
- Services throw `AppError` for business rule violations
- Services use `prisma.$transaction` for atomic multi-step writes
- Services are stateless (no instance state beyond injected dependencies)
- ALWAYS catch `Prisma.PrismaClientKnownRequestError` P2002 for unique constraints
- NEVER access `c` (Hono context) in services
- NEVER import Hono types in service files
