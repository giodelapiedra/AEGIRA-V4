---
description: Error Handling Patterns for AEGIRA Backend
globs: ["aegira-backend/**/*.ts"]
alwaysApply: false
---
# Error Handling

AEGIRA uses a custom `AppError` class and an `Errors` factory for consistent error responses.

## AppError Class

```typescript
class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 400
  ) {
    super(message);
  }
}
```

## Errors Factory (USE THIS)

```typescript
import { AppError, Errors } from '../../shared/errors';

throw Errors.notFound('Person');         // 404 - "Person not found"
throw Errors.unauthorized();             // 401 - "Unauthorized"
throw Errors.forbidden('Access denied'); // 403 - "Access denied"
throw Errors.conflict('Email exists');   // 409 - "Email exists"
throw Errors.validation('Invalid ID');   // 400 - "Invalid ID"
throw Errors.internal();                 // 500 - "Internal server error"
```

## Custom Errors

For domain-specific errors, use `AppError` directly:

```typescript
throw new AppError('DUPLICATE_EMAIL', 'Email already exists', 409);
throw new AppError('OUTSIDE_CHECK_IN_WINDOW', 'Check-in window closed', 400);
throw new AppError('NOT_ELIGIBLE', 'Check-in not required today', 400);
```

## Error Response Format

All errors are caught by the error middleware and returned as:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Person not found"
  }
}
```

## Global Error Handler (app.ts)

All errors are caught by the global `onError` handler:

```typescript
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.statusCode as 400 | 401 | 403 | 404 | 409 | 500
    );
  }

  // Unexpected error - log full stack, return generic message
  logger.error({ error: err.message, stack: err.stack, path: c.req.path });
  return c.json(
    { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    500
  );
});
```

## Rules

- ALWAYS use `Errors.*` factory for common HTTP errors
- ALWAYS use `AppError` for domain-specific error codes
- ALWAYS provide user-friendly messages (no technical jargon)
- NEVER return raw database errors to client
- NEVER swallow errors - always handle or propagate
- NEVER log sensitive data in error messages (passwords, tokens, PII)
- Error codes use SCREAMING_SNAKE_CASE
- Module path: `src/modules/<feature>/` → routes, controller, repository, validator, service (optional)
- Middleware chain: `authMiddleware` → `tenantMiddleware` → `roleMiddleware` → `zValidator` → `controller`
- Pagination: `parsePagination()` + `calculateSkip()` + `paginate()` from `shared/utils`
- Tenant isolation: extend `BaseRepository`, use `this.where()` for reads, `this.withCompany()` for creates
- Errors: `Errors.notFound()`, `Errors.forbidden()`, or `new AppError('CODE', 'message', status)`
- Response: `{ success: true, data: { ... } }`
- Specific routes BEFORE dynamic `/:id` routes
