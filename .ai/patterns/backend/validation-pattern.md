# Validation Pattern
> Zod schemas for input validation with type exports - every route MUST have validation

## When to Use
- Every route that accepts request body (`POST`, `PATCH`)
- Every route with query parameters that need type safety
- Every route with path parameters (UUID validation)
- When defining TypeScript types for request data

## Canonical Implementation

### Create Schema (All Required Fields)
```typescript
import { z } from 'zod';

// Time format validation (HH:MM) - reusable across modules
const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

// Work days validation (CSV of 0-6, e.g., "1,2,3,4,5")
const workDaysRegex = /^[0-6](,[0-6])*$/;

export const createPersonSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  dateOfBirth: z.string().optional(),
  teamId: z.string().uuid().optional(),
  role: z.enum(['ADMIN', 'WHS', 'SUPERVISOR', 'TEAM_LEAD', 'WORKER']).default('WORKER'),
  workDays: z.string().regex(workDaysRegex, 'Invalid work days format').optional(),
  checkInStart: z.string().regex(timeRegex, 'Invalid time format (HH:MM)').optional(),
  checkInEnd: z.string().regex(timeRegex, 'Invalid time format (HH:MM)').optional(),
});

// ALWAYS export inferred types
export type CreatePersonInput = z.infer<typeof createPersonSchema>;
```

### Update Schema (Partial Fields)
```typescript
// Option 1: Manual partial (when update has different rules than create)
export const updatePersonSchema = z.object({
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName: z.string().min(1).max(100).trim().optional(),
  gender: z.enum(['MALE', 'FEMALE']).nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  workDays: z.string().regex(workDaysRegex).nullable().optional(),
  checkInStart: z.string().regex(timeRegex).nullable().optional(),
  checkInEnd: z.string().regex(timeRegex).nullable().optional(),
});

export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;

// Option 2: Derived partial (when update is simply all-optional create)
export const updateTeamSchema = createTeamSchema.partial();
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
```

### Schema with Cross-Field Validation (.refine)
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

### Schema with Paired-Field Validation
```typescript
export const createPersonSchema = z.object({
  // ... fields ...
  checkInStart: z.string().regex(timeRegex).optional(),
  checkInEnd: z.string().regex(timeRegex).optional(),
}).refine(
  (data) => {
    // If checkInStart is set, checkInEnd must also be set (and vice versa)
    if (data.checkInStart && !data.checkInEnd) return false;
    if (data.checkInEnd && !data.checkInStart) return false;
    return true;
  },
  {
    message: 'Both checkInStart and checkInEnd must be set together',
    path: ['checkInStart'],
  }
);
```

### Query Parameter Schema
```typescript
export const getCheckInHistorySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type GetCheckInHistoryInput = z.infer<typeof getCheckInHistorySchema>;
```

### Enum Filter Schema
```typescript
export const getMissedCheckInsQuerySchema = z.object({
  status: z.enum(['OPEN', 'INVESTIGATING', 'EXCUSED', 'RESOLVED']).optional(),
  workerId: z.string().optional(),
});

export type GetMissedCheckInsQuery = z.infer<typeof getMissedCheckInsQuerySchema>;
```

### Enum with Custom Error Messages
```typescript
export const updateUserRoleSchema = z.object({
  role: z.enum(['WORKER', 'TEAM_LEAD', 'SUPERVISOR', 'ADMIN'], {
    errorMap: () => ({ message: 'Role must be WORKER, TEAM_LEAD, SUPERVISOR, or ADMIN' }),
  }),
});

export type UpdateUserRoleData = z.infer<typeof updateUserRoleSchema>;
```

### Date String Schema
```typescript
export const createHolidaySchema = z.object({
  name: z.string().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recurring: z.boolean().optional().default(false),
});

export type CreateHolidayData = z.infer<typeof createHolidaySchema>;
```

### Restricted Update Schema (Subset of Fields)
```typescript
// Schema for users updating their OWN profile (limited fields)
export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName: z.string().min(1).max(100).trim().optional(),
  gender: z.enum(['MALE', 'FEMALE']).nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
```

### Validation Hook for Custom Error Format
```typescript
import type { Context } from 'hono';
import type { z } from 'zod';

// Use with zValidator to customize error response format
const validationHook = (
  result: { success: boolean; error?: z.ZodError },
  c: Context
) => {
  if (!result.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: result.error!.issues[0].message,
        },
      },
      400
    );
  }
};

// Usage in routes:
router.post('/', zValidator('json', schema, validationHook), controller.create);
```

## Rules
- ✅ DO export inferred types: `export type X = z.infer<typeof xSchema>`
- ✅ DO use `.partial()` for update schemas when all fields follow the same pattern
- ✅ DO use `.trim()` on string fields to strip whitespace
- ✅ DO use `.toLowerCase()` on email fields
- ✅ DO use `.default()` for fields with sensible defaults
- ✅ DO validate UUIDs with `.uuid()` for ID fields
- ✅ DO use `z.enum()` for fields with a fixed set of allowed values
- ✅ DO use `.refine()` for cross-field validation
- ✅ DO use `z.coerce.number()` or `z.coerce.date()` for query params (they arrive as strings)
- ✅ DO keep all schemas in `<feature>.validator.ts`
- ✅ DO use `.nullable().optional()` for update fields that can be cleared
- ❌ NEVER skip validation on routes -- every route MUST have `zValidator`
- ❌ NEVER use `any` for form data types -- always export `z.infer` types
- ❌ NEVER validate in the controller -- use `zValidator` middleware in routes
- ❌ NEVER duplicate validation logic between create and update schemas

## Common Mistakes

### WRONG: No Type Export
```typescript
export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});
// WRONG - no type export, controller must use `any` or inline type
```

### CORRECT: Export Inferred Type
```typescript
export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

// CORRECT - type exported for use in controller
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
```

### WRONG: Email Without Normalization
```typescript
export const createPersonSchema = z.object({
  email: z.string().email(), // WRONG - not trimmed or lowercased
  name: z.string(),          // WRONG - no min/max, not trimmed
});
```

### CORRECT: Normalized Email and Bounded Strings
```typescript
export const createPersonSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  name: z.string().min(1).max(100).trim(),
});
```

### WRONG: Hardcoded Query Params in Controller
```typescript
// check-in.controller.ts
export async function getHistory(c: Context): Promise<Response> {
  // WRONG - parsing and validating in controller
  const page = Number(c.req.query('page')) || 1;
  const limit = Math.min(Number(c.req.query('limit')) || 20, 100);
  const startDate = c.req.query('startDate') ? new Date(c.req.query('startDate')!) : undefined;
}
```

### CORRECT: Schema with Coercion for Query Params
```typescript
// check-in.validator.ts
export const getCheckInHistorySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

// check-in.routes.ts
router.get('/history', zValidator('query', getCheckInHistorySchema), controller.getHistory);
```

### WRONG: Separate Create and Update Schemas with Duplication
```typescript
export const createTeamSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  checkInStart: z.string().regex(timeRegex).optional(),
  checkInEnd: z.string().regex(timeRegex).optional(),
});

// WRONG - duplicating all fields instead of using partial()
export const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).optional(),
  checkInStart: z.string().regex(timeRegex).optional(),
  checkInEnd: z.string().regex(timeRegex).optional(),
});
```

### CORRECT: Derive Update from Create
```typescript
export const createTeamSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  checkInStart: z.string().regex(timeRegex).optional(),
  checkInEnd: z.string().regex(timeRegex).optional(),
});

// CORRECT - derive from create schema
export const updateTeamSchema = createTeamSchema.partial();

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
```
