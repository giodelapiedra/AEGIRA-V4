# Fire-and-Forget Pattern
> Non-blocking side effects - audit logs and notifications NEVER block main operations

## When to Use
- Audit logging after create/update/delete operations
- Sending notifications to users (team assignments, alerts, reminders)
- Any non-critical side effect that should not delay the main response
- Background tasks that can fail silently without affecting the user

## Canonical Implementation

### logAudit - Fire-and-Forget Audit Logging
```typescript
// shared/audit.ts
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

interface AuditLogInput {
  companyId: string;
  personId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

/**
 * Create an audit log entry (non-blocking fire-and-forget).
 * Errors are logged but never thrown - audit failure must not break the main operation.
 */
export function logAudit(input: AuditLogInput): void {
  prisma.auditLog
    .create({
      data: {
        company_id: input.companyId,
        person_id: input.personId,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId || null,
        details: (input.details || {}) as Prisma.InputJsonValue,
      },
    })
    .catch((error: unknown) => {
      logger.error(
        { error, action: input.action, entityType: input.entityType },
        'Failed to create audit log'
      );
    });
}
```

### Usage in Controllers
```typescript
import { logAudit } from '../../shared/audit';

export async function createTeam(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const data = await c.req.json() as CreateTeamInput;

  const repository = getRepository(companyId);
  const result = await repository.create(data);

  // Fire-and-forget: NO await, NO try/catch needed
  logAudit({
    companyId,
    personId: userId,
    action: 'CREATE_TEAM',
    entityType: 'TEAM',
    entityId: result.id,
    details: { name: data.name, leaderId: data.leaderId },
  });

  return c.json({ success: true, data: result }, 201);
}

export async function updateCompanySettings(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const data = await c.req.json() as UpdateSettingsData;

  const repository = new AdminRepository(prisma, companyId);
  const company = await repository.updateCompany(data);

  // Fire-and-forget audit
  logAudit({
    companyId,
    personId: userId,
    action: 'UPDATE_SETTINGS',
    entityType: 'COMPANY',
    entityId: companyId,
    details: data as Record<string, unknown>,
  });

  return c.json({ success: true, data: company });
}

export async function deleteHoliday(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const id = c.req.param('id');

  const repository = new AdminRepository(prisma, companyId);
  const deleted = await repository.deleteHoliday(id);

  if (!deleted) {
    throw new AppError('NOT_FOUND', 'Holiday not found', 404);
  }

  // Fire-and-forget audit
  logAudit({
    companyId,
    personId: userId,
    action: 'DELETE_HOLIDAY',
    entityType: 'HOLIDAY',
    entityId: id,
  });

  return c.json({ success: true, data: { message: 'Holiday deleted' } });
}
```

### Fire-and-Forget Notification Helper
```typescript
import { NotificationRepository } from '../notification/notification.repository';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

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
    // Log error but don't throw - notification failure must not break main operation
    logger.error(
      { error, leaderId, teamName },
      'Failed to send team lead assignment notification'
    );
  }
}

// Called WITHOUT await from controller:
export async function createTeam(c: Context): Promise<Response> {
  // ... create team logic ...
  const result = await repository.create(data);

  // Both are fire-and-forget: no await
  notifyTeamLeadAssignment(companyId, data.leaderId, result.name);
  logAudit({
    companyId,
    personId: userId,
    action: 'CREATE_TEAM',
    entityType: 'TEAM',
    entityId: result.id,
    details: { name: data.name },
  });

  return c.json({ success: true, data: result }, 201);
}
```

### Pagination Utilities (Commonly Used Alongside)

These utilities are used in every list controller alongside fire-and-forget audit:

```typescript
// shared/utils.ts
import type { PaginationParams, PaginatedResponse } from '../types/api.types';

/**
 * Parses and clamps pagination query params.
 * Ensures page >= 1 and limit is between 1 and 100.
 */
export function parsePagination(
  pageParam?: string | null,
  limitParam?: string | null,
  defaultLimit = 20
): PaginationParams {
  return {
    page: clamp(Number(pageParam) || 1, 1, 10000),
    limit: clamp(Number(limitParam) || defaultLimit, 1, 100),
  };
}

/**
 * Calculates pagination skip value
 */
export function calculateSkip(params: PaginationParams): number {
  return (params.page - 1) * params.limit;
}

/**
 * Creates a paginated response
 */
export function paginate<T>(
  items: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  return {
    items,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  };
}
```

### Using parsePagination in List Controllers
```typescript
export async function listAuditLogs(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'), 50);
  const type = c.req.query('type');
  const search = c.req.query('search');

  const repository = new AdminRepository(prisma, companyId);
  const paginatedData = await repository.listAuditLogs(
    { page, limit },
    { type, search }
  );

  return c.json({ success: true, data: paginatedData });
}
```

### Using paginate in Repositories
```typescript
async findByPerson(
  personId: string,
  params: PaginationParams & { filter?: 'unread' | 'read' }
): Promise<PaginatedResponse<Notification>> {
  const where: Prisma.NotificationWhereInput = {
    company_id: this.companyId,
    person_id: personId,
    ...(params.filter === 'unread' && { read_at: null }),
  };

  const [items, total] = await Promise.all([
    this.prisma.notification.findMany({
      where,
      skip: calculateSkip(params),
      take: params.limit,
      orderBy: { created_at: 'desc' },
    }),
    this.prisma.notification.count({ where }),
  ]);

  return paginate(items, total, params);
}
```

### Common Audit Action Codes

| Action | Entity Type | When |
|--------|-------------|------|
| `CREATE_TEAM` | `TEAM` | Team created |
| `UPDATE_TEAM` | `TEAM` | Team updated |
| `CREATE_PERSON` | `PERSON` | Person/worker created |
| `UPDATE_PERSON` | `PERSON` | Person/worker updated |
| `UPDATE_ROLE` | `PERSON` | User role changed |
| `UPDATE_SETTINGS` | `COMPANY` | Company settings modified |
| `CREATE_HOLIDAY` | `HOLIDAY` | Holiday added |
| `UPDATE_HOLIDAY` | `HOLIDAY` | Holiday modified |
| `DELETE_HOLIDAY` | `HOLIDAY` | Holiday removed |

## Rules
- ✅ DO call `logAudit()` without `await` -- it handles its own error catching internally
- ✅ DO use `.catch()` on Promise chains for fire-and-forget operations
- ✅ DO wrap notification helpers in `try/catch` with `logger.error` for failures
- ✅ DO call notification helpers without `await` in the controller
- ✅ DO use `parsePagination()` for all list endpoints
- ✅ DO use `calculateSkip()` and `paginate()` in repositories
- ✅ DO pass `details` to `logAudit` with relevant context (e.g., changed fields)
- ✅ DO make the return type `void` for fire-and-forget functions (not `Promise<void>` exposed to caller)
- ❌ NEVER `await` fire-and-forget operations in controllers
- ❌ NEVER let logging errors crash main operations
- ❌ NEVER let notification failures propagate to the client
- ❌ NEVER skip audit logging on state-changing operations (create/update/delete)
- ❌ NEVER block the HTTP response waiting for side effects to complete

## Common Mistakes

### WRONG: Awaiting Audit Log
```typescript
export async function createTeam(c: Context): Promise<Response> {
  const result = await repository.create(data);

  // WRONG - awaiting blocks the response
  await logAudit({
    companyId,
    personId: userId,
    action: 'CREATE_TEAM',
    entityType: 'TEAM',
    entityId: result.id,
  });

  return c.json({ success: true, data: result }, 201);
}
```

### CORRECT: Fire-and-Forget
```typescript
export async function createTeam(c: Context): Promise<Response> {
  const result = await repository.create(data);

  // CORRECT - no await, response returns immediately
  logAudit({
    companyId,
    personId: userId,
    action: 'CREATE_TEAM',
    entityType: 'TEAM',
    entityId: result.id,
  });

  return c.json({ success: true, data: result }, 201);
}
```

### WRONG: Notification Error Propagating to Client
```typescript
export async function createTeam(c: Context): Promise<Response> {
  const result = await repository.create(data);

  // WRONG - if notification fails, client gets 500 error
  const notificationRepo = new NotificationRepository(prisma, companyId);
  await notificationRepo.create({
    personId: data.leaderId,
    type: 'TEAM_ALERT',
    title: 'Assignment',
    message: `Assigned to ${result.name}`,
  });

  return c.json({ success: true, data: result }, 201);
}
```

### CORRECT: Wrapped in Try/Catch, No Await
```typescript
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
      title: 'Assignment',
      message: `Assigned to ${teamName}`,
    });
  } catch (error) {
    logger.error({ error, leaderId, teamName }, 'Failed to send notification');
  }
}

export async function createTeam(c: Context): Promise<Response> {
  const result = await repository.create(data);

  // CORRECT - helper handles its own errors, called without await
  notifyTeamLeadAssignment(companyId, data.leaderId, result.name);

  return c.json({ success: true, data: result }, 201);
}
```

### WRONG: Missing Audit on Delete
```typescript
export async function deleteHoliday(c: Context): Promise<Response> {
  const repository = new AdminRepository(prisma, companyId);
  await repository.deleteHoliday(id);
  // WRONG - no audit trail for deletion
  return c.json({ success: true, data: { message: 'Holiday deleted' } });
}
```

### CORRECT: Audit All State Changes
```typescript
export async function deleteHoliday(c: Context): Promise<Response> {
  const repository = new AdminRepository(prisma, companyId);
  const deleted = await repository.deleteHoliday(id);

  if (!deleted) {
    throw new AppError('NOT_FOUND', 'Holiday not found', 404);
  }

  // CORRECT - audit trail for all state-changing operations
  logAudit({
    companyId,
    personId: userId,
    action: 'DELETE_HOLIDAY',
    entityType: 'HOLIDAY',
    entityId: id,
  });

  return c.json({ success: true, data: { message: 'Holiday deleted' } });
}
```
