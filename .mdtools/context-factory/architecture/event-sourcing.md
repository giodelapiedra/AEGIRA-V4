---
description: Event Sourcing Architecture for AEGIRA
globs: ["aegira-backend/**/*.ts"]
alwaysApply: false
---
# Event Sourcing

AEGIRA uses event sourcing for an immutable audit trail of all state changes.

## Core Rules

1. **ALL state changes create immutable Event records**
2. **NEVER UPDATE or DELETE event records**
3. **Create event FIRST, then the specific table entry**
4. **Link specific records to events via `event_id` foreign key**

## Event Types

```typescript
enum EventType {
  CHECK_IN_SUBMITTED   = 'CHECK_IN_SUBMITTED',
  CHECK_IN_UPDATED     = 'CHECK_IN_UPDATED',
  PERSON_CREATED       = 'PERSON_CREATED',
  PERSON_UPDATED       = 'PERSON_UPDATED',
  TEAM_CREATED         = 'TEAM_CREATED',
  TEAM_UPDATED         = 'TEAM_UPDATED',
  // ... more event types
}
```

## Pattern: Creating a State Change

```typescript
async submitCheckIn(data, personId: string, companyId: string) {
  return this.prisma.$transaction(async (tx) => {
    // 1. Create the event FIRST
    const event = await tx.event.create({
      data: {
        type: 'CHECK_IN_SUBMITTED',
        person_id: personId,
        company_id: companyId,
        payload: data,
      },
    });

    // 2. Create the specific record, linking to the event
    const checkIn = await tx.checkIn.create({
      data: {
        ...data,
        person_id: personId,
        company_id: companyId,
        event_id: event.id,
      },
    });

    return checkIn;
  });
}
```

## Audit Log

In addition to events, administrative actions are tracked via `AuditLog`:

```typescript
await tx.auditLog.create({
  data: {
    action: 'PERSON_DEACTIVATED',
    entity_type: 'Person',
    entity_id: personId,
    performed_by: adminId,
    company_id: companyId,
    details: { reason },
  },
});
```

## Rules

- Events are **append-only** - never update, never delete
- Use Prisma **transactions** to ensure event + record are created atomically
- Store the full payload in the event for reconstruction
- Event `type` must match a defined `EventType` enum value
- Every event belongs to a `company_id` (multi-tenant)
- EVERY database query MUST filter by `company_id`
- NO `any` types — strict TypeScript
- Server state → TanStack Query, client state → Zustand (auth only)
- JWT in httpOnly cookie — no tokens in localStorage or Zustand
- Tailwind CSS only — no inline styles
- NEVER hard delete — use `is_active: false`
