---
description: Middleware Patterns for AEGIRA Backend
globs: ["aegira-backend/src/middleware/**/*.ts"]
alwaysApply: false
---
# Middleware

AEGIRA uses a layered middleware chain applied to all routes.

## Middleware Stack

```
Request → authMiddleware → tenantMiddleware → roleMiddleware → zValidator → Controller
```

### authMiddleware (`middleware/auth.ts`)
- Extracts JWT from cookie
- Validates token, decodes payload
- Sets context values:
  ```typescript
  c.set('user', decodedUser);       // { id, email, companyId, role }
  c.set('companyId', user.companyId);
  c.set('userId', user.id);
  c.set('userRole', user.role);
  ```

### tenantMiddleware (`middleware/tenant.ts`)
- Validates that `companyId` from JWT corresponds to an active company
- Rejects requests for deactivated companies

### roleMiddleware (`middleware/role.ts`)
- Factory function that returns middleware for specific roles:
  ```typescript
  const adminOnly = roleMiddleware(['ADMIN']);
  const teamLeadUp = roleMiddleware(['TEAM_LEAD', 'SUPERVISOR', 'ADMIN']);
  ```
- Checks `userRole` against allowed roles
- Throws `Errors.forbidden()` if role not allowed

### Error Middleware
- Global error handler that catches all `AppError` instances
- Formats errors into `{ success: false, error: { code, message } }`
- Logs errors with context via Pino

## Context Values Available After Auth

```typescript
const user     = c.get('user') as AuthenticatedUser;
const companyId = c.get('companyId') as string;
const userId   = c.get('userId') as string;
const userRole = c.get('userRole') as string;
```

## Roles Hierarchy

```
WORKER < TEAM_LEAD < SUPERVISOR < ADMIN
```

| Role       | Typical Access                              |
| ---------- | ------------------------------------------- |
| WORKER     | Own check-ins, own profile                  |
| TEAM_LEAD  | Team members' data, own team management     |
| SUPERVISOR | Multiple teams' data, broader oversight     |
| ADMIN      | Full company access, user/team management   |
