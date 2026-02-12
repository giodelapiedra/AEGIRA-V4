# Error Handling (Backend)
> AppError class with structured codes, Prisma error mapping, and global error handler

## When to Use
- Every backend module that needs to throw business errors
- When mapping Prisma database errors to user-friendly responses
- When defining error responses for validation, auth, and domain-specific failures
- When handling unexpected errors gracefully in production

## Canonical Implementation

### AppError Class
```typescript
// shared/errors.ts
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}
```

### Factory Functions for Common Errors
```typescript
// shared/errors.ts
export const Errors = {
  notFound: (resource: string): AppError =>
    new AppError('NOT_FOUND', `${resource} not found`, 404),

  unauthorized: (message = 'Unauthorized'): AppError =>
    new AppError('UNAUTHORIZED', message, 401),

  forbidden: (message = 'Access denied'): AppError =>
    new AppError('FORBIDDEN', message, 403),

  conflict: (message: string): AppError =>
    new AppError('CONFLICT', message, 409),

  validation: (message: string): AppError =>
    new AppError('VALIDATION_ERROR', message, 400),

  internal: (message = 'Internal server error'): AppError =>
    new AppError('INTERNAL_ERROR', message, 500),
};
```

### Usage in Controllers and Services
```typescript
import { AppError, Errors } from '../../shared/errors';

// Using factory functions for standard cases
const team = await repository.findById(id);
if (!team) {
  throw Errors.notFound('Team');
}

// Using AppError directly for domain-specific errors
throw new AppError('DUPLICATE_CHECK_IN', 'Check-in already submitted for today', 409);
throw new AppError('OUTSIDE_CHECK_IN_WINDOW', 'Check-in window is closed', 400);
throw new AppError('LEADER_ALREADY_ASSIGNED', `Leader already assigned to "${team.name}"`, 409);
throw new AppError('INVALID_LEADER_ROLE', 'Team leader must have TEAM_LEAD role', 400);
throw new AppError('NOT_WORK_DAY', 'Today is not a scheduled work day', 400);
throw new AppError('HOLIDAY', 'Today is a company holiday', 400);
```

### Global Error Handler (app.ts)
```typescript
import { Hono } from 'hono';
import { AppError } from './shared/errors';
import { logger } from './config/logger';

const app = new Hono();

app.onError((err, c) => {
  // Known business errors - return structured response
  if (err instanceof AppError) {
    logger.warn({
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      path: c.req.path,
    });

    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      },
      err.statusCode as 400 | 401 | 403 | 404 | 409 | 500
    );
  }

  // Unexpected errors - log full stack, return generic message
  logger.error({
    error: err.message,
    stack: err.stack,
    path: c.req.path,
  });

  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
    500
  );
});
```

### Prisma Error Mapping
```typescript
import { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors';

// In service or repository methods that catch Prisma errors
try {
  return await prisma.$transaction(async (tx) => {
    // ... database operations
  });
} catch (error) {
  // P2002: Unique constraint violation
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new AppError('DUPLICATE_CHECK_IN', 'Check-in already submitted for today', 409);
  }

  // P2003: Foreign key constraint failure
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2003'
  ) {
    throw new AppError('INVALID_REFERENCE', 'Referenced entity does not exist', 400);
  }

  // P2025: Record not found (for update/delete operations)
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    throw new AppError('NOT_FOUND', 'Record not found', 404);
  }

  // Re-throw unknown errors (global handler catches them)
  throw error;
}
```

### Error Code Conventions

| Code | HTTP Status | When to Use |
|------|-------------|-------------|
| `NOT_FOUND` | 404 | Entity not found |
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `FORBIDDEN` | 403 | Authenticated but insufficient permissions |
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `CONFLICT` | 409 | Generic duplicate / state conflict |
| `DUPLICATE_CHECK_IN` | 409 | Already checked in today |
| `DUPLICATE_TEAM` | 409 | Team name already exists |
| `OUTSIDE_CHECK_IN_WINDOW` | 400 | Time-based eligibility failure |
| `NOT_WORK_DAY` | 400 | Schedule-based eligibility failure |
| `HOLIDAY` | 400 | Company holiday blocks operation |
| `INVALID_LEADER` | 400 | Leader not found or wrong role |
| `LEADER_ALREADY_ASSIGNED` | 409 | Leader already leads another team |
| `LEADER_REQUIRED` | 400 | Missing required leader assignment |
| `INTERNAL_ERROR` | 500 | Unexpected server error (generic message) |

### Error Response Format
```typescript
// All errors follow this format (enforced by global handler):
{
  success: false,
  error: {
    code: 'UPPER_SNAKE_CASE_CODE',
    message: 'Human-readable message for the user'
  }
}
```

## Rules
- ✅ DO use `AppError` for all business errors (not raw `Error`)
- ✅ DO use factory functions (`Errors.notFound`, `Errors.forbidden`) for standard HTTP errors
- ✅ DO use `new AppError(code, message, statusCode)` for domain-specific errors
- ✅ DO use UPPER_SNAKE_CASE for error codes
- ✅ DO write user-friendly error messages (these are shown to the user)
- ✅ DO map Prisma errors (P2002, P2003, P2025) to `AppError` in services
- ✅ DO re-throw unexpected errors (let global handler catch them)
- ✅ DO log `warn` level for expected `AppError`, `error` level for unexpected errors
- ❌ NEVER expose internal implementation details in error messages
- ❌ NEVER expose stack traces in production (global handler strips them)
- ❌ NEVER throw raw `Error` -- always use `AppError`
- ❌ NEVER catch errors in controller unless you need to transform them
- ❌ NEVER return error responses manually in controllers -- throw `AppError` and let global handler format

## Common Mistakes

### WRONG: Raw Error
```typescript
export async function getTeamById(c: Context): Promise<Response> {
  const team = await repository.findById(id);
  if (!team) {
    // WRONG - raw Error, not caught by global handler properly
    throw new Error('Team not found');
  }
  return c.json({ success: true, data: team });
}
```

### CORRECT: AppError
```typescript
export async function getTeamById(c: Context): Promise<Response> {
  const team = await repository.findById(id);
  if (!team) {
    // CORRECT - structured error with code and status
    throw new AppError('NOT_FOUND', 'Team not found', 404);
    // OR use factory: throw Errors.notFound('Team');
  }
  return c.json({ success: true, data: team });
}
```

### WRONG: Manual Error Response in Controller
```typescript
export async function createTeam(c: Context): Promise<Response> {
  const existing = await repository.findByName(data.name);
  if (existing) {
    // WRONG - manually formatting error response, bypasses global handler
    return c.json({
      success: false,
      error: { code: 'DUPLICATE', message: 'Team exists' },
    }, 409);
  }
}
```

### CORRECT: Throw AppError, Let Global Handler Format
```typescript
export async function createTeam(c: Context): Promise<Response> {
  const existing = await repository.findByName(data.name);
  if (existing) {
    // CORRECT - throw AppError, global handler returns { success: false, error: {...} }
    throw new AppError('DUPLICATE_TEAM', 'Team with this name already exists', 409);
  }
}
```

### WRONG: Exposing Internal Details
```typescript
throw new AppError(
  'DB_ERROR',
  `Prisma error P2002: Unique constraint on field person_id_check_in_date`,
  500
);
```

### CORRECT: User-Friendly Message
```typescript
throw new AppError(
  'DUPLICATE_CHECK_IN',
  'Check-in already submitted for today',
  409
);
```

### WRONG: Swallowing Unexpected Errors
```typescript
try {
  return await prisma.$transaction(async (tx) => { /* ... */ });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AppError('DUPLICATE', 'Already exists', 409);
  }
  // WRONG - swallowing unknown errors silently
  logger.error(error);
  return null;
}
```

### CORRECT: Re-throw Unknown Errors
```typescript
try {
  return await prisma.$transaction(async (tx) => { /* ... */ });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AppError('DUPLICATE', 'Already exists', 409);
  }
  // CORRECT - re-throw so global handler catches it
  throw error;
}
```
