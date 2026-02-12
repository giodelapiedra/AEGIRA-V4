---
name: backend-service
description: Generate a backend service layer for AEGIRA. Use when a feature needs business logic, multi-step operations, eligibility checks, or Prisma transactions beyond simple CRUD.
---
# Backend Service Layer

Add a service when the feature needs business logic beyond simple CRUD. Services sit between controllers and repositories.

## When to Use

<!-- @pattern: shared/decision-trees -->

## File Location

```
src/modules/<feature>/<feature>.service.ts
```

## Service Layer Pattern

<!-- @pattern: backend/service-layer -->

## Controller Integration

<!-- @pattern: backend/controller-pattern -->

## Error Handling

<!-- @pattern: backend/error-handling -->

## Checklist

- [ ] Services contain business logic ONLY (no HTTP concerns)
- [ ] Services receive repositories via constructor (dependency injection)
- [ ] Services throw `AppError` for business rule violations
- [ ] Services use `prisma.$transaction` for atomic multi-step writes
- [ ] Services are stateless (no instance state beyond injected dependencies)
- [ ] Gets timezone from `c.get('companyTimezone')` in the controller
- [ ] Catches `Prisma.PrismaClientKnownRequestError` P2002 for unique constraints
- [ ] Uses timezone utilities from `shared/utils` for date/time operations
- [ ] Includes fire-and-forget `logAudit()` in the controller after service calls
- [ ] NEVER accesses Hono context in services
- [ ] NEVER imports Hono types in service files
