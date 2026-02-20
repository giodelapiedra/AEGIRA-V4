---
name: backend-crud-module
description: Generate a complete backend CRUD module for AEGIRA. Use when creating a new feature module with routes, controller, repository, and validator under aegira-backend/src/modules/.
---
# Backend CRUD Module

Generate all files for a new feature module under `aegira-backend/src/modules/<feature>/`.

## File Structure

```
src/modules/<feature>/
├── <feature>.routes.ts
├── <feature>.controller.ts
├── <feature>.repository.ts
└── <feature>.validator.ts
```

## Module Structure Pattern

<!-- @pattern: backend/module-structure -->

## Routes Pattern

<!-- @pattern: backend/routes-pattern -->

## Validator Pattern

<!-- @pattern: backend/validation-pattern -->

## Repository Pattern

<!-- @pattern: backend/repository-pattern -->

## Controller Pattern

<!-- @pattern: backend/controller-pattern -->

## Fire-and-Forget Audit

<!-- @pattern: backend/fire-and-forget -->

## Register Routes

After generating the module, register the routes in the main app:

```typescript
// In src/app.ts (or wherever routes are mounted)
import { featureRoutes } from './modules/<feature>/<feature>.routes';

app.route('/features', featureRoutes);
```

## Context Variables Reference

Set by middleware, available in all controllers:

```typescript
const companyId = c.get('companyId') as string;       // From authMiddleware
const userId = c.get('userId') as string;             // From authMiddleware
const user = c.get('user') as AuthenticatedUser;      // From authMiddleware
const userRole = c.get('userRole') as string;         // From authMiddleware
const timezone = c.get('companyTimezone') as string;  // From tenantMiddleware
```

## Checklist

- [ ] Extends `BaseRepository` for tenant isolation
- [ ] Uses `this.where()` for reads, explicit `company_id` for creates
- [ ] Runs `findMany` + `count` in parallel with `Promise.all`
- [ ] Checks existence before update/delete
- [ ] Returns `{ success: true, data: ... }` format
- [ ] Exports inferred types from validators
- [ ] Places specific routes before dynamic `/:id` routes
- [ ] Uses `findFirst` with `this.where()` for primary key lookups (never `findUnique` — it doesn't support compound `company_id` filtering)
- [ ] Validates path params with `zValidator('param', idSchema)`
- [ ] Maps camelCase input to snake_case DB columns in create
- [ ] Includes fire-and-forget `logAudit()` in create/update/delete
- [ ] Registers new routes in app.ts
