# Controller Pattern
> Request handling layer - parse input, call service/repo, format response, fire-and-forget audit

## When to Use
- Every backend module endpoint handler
- When parsing request parameters, body, and query strings
- When formatting responses with the standard `{ success, data }` wrapper
- When firing off non-blocking side effects (audit logs, notifications)

## Canonical Implementation

### Basic Controller Structure
```typescript
import type { Context } from 'hono';
import { PersonRepository } from './person.repository';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/errors';
import { parsePagination } from '../../shared/utils';
import { logAudit } from '../../shared/audit';
import type { AuthenticatedUser } from '../../types/api.types';
import type { CreatePersonInput } from './person.validator';

// Helper to create repository with tenant scope
function getRepository(companyId: string): PersonRepository {
  return new PersonRepository(prisma, companyId);
}
```

### List Controller (Paginated)
```typescript
export async function listPersons(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'));
  const search = c.req.query('search')?.trim();
  const includeInactive = c.req.query('includeInactive') === 'true';

  const repository = getRepository(companyId);
  const result = await repository.findAll({ page, limit, includeInactive, search });

  return c.json({ success: true, data: result });
}
```

### GetById Controller
```typescript
export async function getPersonById(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const id = c.req.param('id');

  if (!id) {
    throw new AppError('VALIDATION_ERROR', 'Person ID is required', 400);
  }

  const repository = getRepository(companyId);
  const result = await repository.findById(id);

  if (!result) {
    throw new AppError('NOT_FOUND', 'Person not found', 404);
  }

  return c.json({ success: true, data: result });
}
```

### Create Controller (with Audit)
```typescript
export async function createPerson(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const data = await c.req.json() as CreatePersonInput;

  const repository = getRepository(companyId);
  const result = await repository.create(data);

  // Audit (fire-and-forget - never await, never throw)
  logAudit({
    companyId,
    personId: userId,
    action: 'CREATE_PERSON',
    entityType: 'PERSON',
    entityId: result.id,
    details: { email: data.email, role: data.role },
  });

  return c.json({ success: true, data: result }, 201);
}
```

### Update Controller (with Audit)
```typescript
export async function updatePerson(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const data = await c.req.json() as UpdatePersonInput;

  if (!id) {
    throw new AppError('VALIDATION_ERROR', 'Person ID is required', 400);
  }

  const repository = getRepository(companyId);
  const existing = await repository.findById(id);
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Person not found', 404);
  }

  const result = await repository.update(id, data);

  // Audit (fire-and-forget)
  logAudit({
    companyId,
    personId: userId,
    action: 'UPDATE_PERSON',
    entityType: 'PERSON',
    entityId: id,
    details: data as Record<string, unknown>,
  });

  return c.json({ success: true, data: result });
}
```

### Controller with Service Layer (Complex Logic)
```typescript
// When module has a service, create a service factory instead of repo factory
function getService(companyId: string, timezone: string): CheckInService {
  const repository = new CheckInRepository(prisma, companyId);
  return new CheckInService(repository, timezone);
}

export async function submitCheckIn(c: Context): Promise<Response> {
  const data = await c.req.json() as CheckInInput;
  const user = c.get('user') as AuthenticatedUser;
  const companyId = c.get('companyId') as string;

  const service = getService(companyId, c.get('companyTimezone') as string);
  const result = await service.submit(data, user.id, companyId);

  return c.json({ success: true, data: result }, 201);
}
```

### Non-blocking Notification Helper
```typescript
/**
 * Send notification when team lead is assigned.
 * Non-blocking - errors are logged but don't break the main operation.
 */
async function notifyTeamLeadAssignment(
  companyId: string,
  leaderId: string,
  teamName: string
): Promise<void> {
  try {
    const notificationRepo = new NotificationRepository(prisma, companyId);
    await notificationRepo.create({
      personId: leaderId,
      type: 'TEAM_ALERT',
      title: 'Team Leadership Assignment',
      message: `You have been assigned as the team lead of ${teamName}.`,
    });
  } catch (error) {
    logger.error({ error, leaderId, teamName }, 'Failed to send team lead assignment notification');
  }
}

// Called without await in the controller:
export async function createTeam(c: Context): Promise<Response> {
  // ... create team ...
  notifyTeamLeadAssignment(companyId, data.leaderId, result.name); // No await
  logAudit({ /* ... */ }); // No await
  return c.json({ success: true, data: result }, 201);
}
```

### Context Variables Available After Middleware
| Variable | Type | Usage |
|----------|------|-------|
| `c.get('companyId')` | `string` | Current tenant ID |
| `c.get('userId')` | `string` | Current user ID |
| `c.get('userRole')` | `string` | Current user role |
| `c.get('user')` | `AuthenticatedUser` | Full user object |
| `c.get('companyTimezone')` | `string` | Company timezone (e.g., `'Asia/Manila'`) |

## Rules
- ✅ DO export controller functions (not classes)
- ✅ DO use `parsePagination(c.req.query('page'), c.req.query('limit'))` for list endpoints
- ✅ DO return `{ success: true, data }` for all success responses
- ✅ DO return HTTP `201` for create operations, `200` for reads/updates/deletes
- ✅ DO fire-and-forget `logAudit()` calls (never `await`)
- ✅ DO extract `companyId` from `c.get('companyId')`, never from request body
- ✅ DO extract `userId` from `c.get('userId')` for audit trails
- ✅ DO use a `getRepository()` or `getService()` helper factory function
- ✅ DO use `as string` for context getters: `c.get('companyId') as string`
- ❌ NEVER put business logic in controllers (delegate to service)
- ❌ NEVER put Prisma queries in controllers (delegate to repository)
- ❌ NEVER `await` audit logging or notification calls
- ❌ NEVER trust client-provided `companyId` -- always use `c.get('companyId')`
- ❌ NEVER catch errors unless you need to transform them -- let the global error handler catch

## Common Mistakes

### WRONG: Prisma Query in Controller
```typescript
export async function createTeam(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const body = await c.req.json();

  // WRONG - direct Prisma query in controller
  const team = await prisma.team.create({
    data: { ...body, company_id: companyId },
  });

  return c.json({ success: true, data: team });
}
```

### CORRECT: Use Repository
```typescript
export async function createTeam(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const body = await c.req.json() as CreateTeamInput;

  const repository = getRepository(companyId);
  const team = await repository.create(body);

  logAudit({
    companyId,
    personId: userId,
    action: 'CREATE_TEAM',
    entityType: 'TEAM',
    entityId: team.id,
    details: { name: body.name },
  });

  return c.json({ success: true, data: team }, 201);
}
```

### WRONG: Awaiting Audit Log
```typescript
export async function createPerson(c: Context): Promise<Response> {
  const result = await repository.create(data);

  // WRONG - awaiting audit log blocks the response
  await logAudit({
    companyId,
    personId: userId,
    action: 'CREATE_PERSON',
    entityType: 'PERSON',
    entityId: result.id,
  });

  return c.json({ success: true, data: result }, 201);
}
```

### CORRECT: Fire-and-Forget Audit
```typescript
export async function createPerson(c: Context): Promise<Response> {
  const result = await repository.create(data);

  // CORRECT - fire-and-forget, no await
  logAudit({
    companyId,
    personId: userId,
    action: 'CREATE_PERSON',
    entityType: 'PERSON',
    entityId: result.id,
  });

  return c.json({ success: true, data: result }, 201);
}
```

### WRONG: Missing Response Wrapper
```typescript
export async function listTeams(c: Context): Promise<Response> {
  const result = await repository.findAll({ page, limit });
  // WRONG - returning raw data without success wrapper
  return c.json(result);
}
```

### CORRECT: Standard Response Format
```typescript
export async function listTeams(c: Context): Promise<Response> {
  const result = await repository.findAll({ page, limit });
  // CORRECT - wrapped in { success, data }
  return c.json({ success: true, data: result });
}
```
