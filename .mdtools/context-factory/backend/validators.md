---
description: Zod Validation Patterns for AEGIRA Backend
globs: ["aegira-backend/src/modules/**/*.validator.ts"]
alwaysApply: false
---
# Validator Patterns

All input validation uses Zod schemas. Validators define schemas and export inferred types.

## Canonical Pattern

```typescript
import { z } from 'zod';

// Create schema - required fields
export const createFeatureSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().toLowerCase().trim(),
  role: z.enum(['ADMIN', 'SUPERVISOR', 'TEAM_LEAD', 'WORKER']).default('WORKER'),
  teamId: z.string().uuid().optional(),
});

// Update schema - all fields optional
export const updateFeatureSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  isActive: z.boolean().optional(),
});

// ALWAYS export inferred types
export type CreateFeatureInput = z.infer<typeof createFeatureSchema>;
export type UpdateFeatureInput = z.infer<typeof updateFeatureSchema>;
```

## Common Field Patterns

```typescript
// String fields
z.string().min(1).max(100).trim()                     // Required text
z.string().email().toLowerCase().trim()                 // Email
z.string().uuid()                                       // UUID

// Number fields
z.number().int().min(1).max(10)                        // Integer range
z.number().min(0).max(24)                              // Decimal range

// Enum fields
z.enum(['ADMIN', 'SUPERVISOR', 'TEAM_LEAD', 'WORKER']) // Fixed set
z.nativeEnum(ReadinessLevel)                            // Prisma enum

// Date fields
z.string().regex(/^\d{4}-\d{2}-\d{2}$/)               // Date string YYYY-MM-DD
z.coerce.date()                                         // Coerce to Date

// Boolean
z.boolean().default(false)

// Optional with default
z.string().default('default_value')
z.number().int().min(1).default(1)                     // Pagination page
z.number().int().min(1).max(100).default(20)           // Pagination limit
```

## Cross-Field Validation with `.refine()`

Use `.refine()` for validation rules that depend on multiple fields:

```typescript
export const submitCheckInSchema = z.object({
  hoursSlept: z.number().min(0).max(24),
  sleepQuality: z.number().min(1).max(10),
  stressLevel: z.number().min(1).max(10),
  physicalCondition: z.number().min(1).max(10),
  painLevel: z.number().int().min(0).max(10).optional(),
  painLocation: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
}).refine(
  (data) => {
    // If pain level is above 0, pain location is required
    if (data.painLevel && data.painLevel > 0 && !data.painLocation?.trim()) {
      return false;
    }
    return true;
  },
  {
    message: 'Pain location is required when pain level is above 0',
    path: ['painLocation'],
  }
);

export type SubmitCheckInInput = z.infer<typeof submitCheckInSchema>;
```

## Validation at Route Level

Schemas are applied via `zValidator` middleware in routes:

```typescript
import { zValidator } from '@hono/zod-validator';
import { createFeatureSchema } from './<feature>.validator';

router.post('/', zValidator('json', createFeatureSchema), controller.create);
```

## Rules

- ALWAYS sanitize strings: `.trim()`, `.toLowerCase()` where appropriate
- ALWAYS export inferred types using `z.infer<typeof schema>`
- ALWAYS use `.uuid()` for ID fields
- ALWAYS set sensible `.min()` and `.max()` bounds
- ALWAYS use `.optional()` for update schema fields
- NEVER validate in controllers - use `zValidator` in routes
- Type names: `Create[Feature]Input`, `Update[Feature]Input`
- Module path: `src/modules/<feature>/` → routes, controller, repository, validator, service (optional)
- Middleware chain: `authMiddleware` → `tenantMiddleware` → `roleMiddleware` → `zValidator` → `controller`
- Pagination: `parsePagination()` + `calculateSkip()` + `paginate()` from `shared/utils`
- Tenant isolation: extend `BaseRepository`, use `this.where()` for reads, `this.withCompany()` for creates
- Errors: `Errors.notFound()`, `Errors.forbidden()`, or `new AppError('CODE', 'message', status)`
- Response: `{ success: true, data: { ... } }`
- Specific routes BEFORE dynamic `/:id` routes
