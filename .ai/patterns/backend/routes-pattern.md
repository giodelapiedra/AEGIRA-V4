# Routes Pattern
> Hono route definitions with middleware stack - auth + tenant + role + validation

## When to Use
- Every backend module that exposes API endpoints
- When defining HTTP methods, paths, middleware chains, and controller handlers
- When applying role-based access control to routes
- When attaching request validation via `zValidator`

## Canonical Implementation

### Standard CRUD Module Routes
```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { roleMiddleware } from '../../middleware/role';
import * as controller from './person.controller';
import { createPersonSchema, updatePersonSchema, updateProfileSchema } from './person.validator';

const router = new Hono();

// Step 1: Apply auth + tenant middleware to ALL routes in this module
router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

// Step 2: Define role groups as reusable variables
const adminOnly = roleMiddleware(['ADMIN']);
const adminOrSupervisor = roleMiddleware(['ADMIN', 'SUPERVISOR']);
const adminSupervisorOrWhs = roleMiddleware(['ADMIN', 'SUPERVISOR', 'WHS']);

// Step 3: Define routes with middleware chain
// Pattern: router.METHOD(path, ...middleware, controller.handler)

// Self-service routes (any authenticated user)
router.get('/me', controller.getCurrentProfile);
router.patch('/me', zValidator('json', updateProfileSchema), controller.updateProfile);

// List and create (restricted roles)
router.get('/', adminSupervisorOrWhs, controller.listPersons);
router.post('/', adminOnly, zValidator('json', createPersonSchema), controller.createPerson);

// Detail and update (parameterized routes LAST)
router.get('/:id', adminSupervisorOrWhs, controller.getPersonById);
router.patch('/:id', adminOnly, zValidator('json', updatePersonSchema), controller.updatePerson);

// Step 4: Export with named export
export { router as personRoutes };
```

### Module With Mixed Role Requirements
```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { roleMiddleware } from '../../middleware/role';
import * as controller from './team.controller';
import * as missedCheckInController from '../missed-check-in/missed-check-in.controller';
import { createTeamSchema, updateTeamSchema } from './team.validator';
import { getMissedCheckInsQuerySchema, updateMissedCheckInSchema } from '../missed-check-in/missed-check-in.validator';

const router = new Hono();

router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

// Role groups
const adminOnly = roleMiddleware(['ADMIN']);
const teamLeadUp = roleMiddleware(['TEAM_LEAD', 'SUPERVISOR', 'ADMIN']);
const teamLeadUpOrWhs = roleMiddleware(['TEAM_LEAD', 'SUPERVISOR', 'ADMIN', 'WHS']);

// ADMIN-only management routes
router.get('/', adminOnly, controller.listTeams);
router.post('/', adminOnly, zValidator('json', createTeamSchema), controller.createTeam);

// IMPORTANT: Specific routes MUST come BEFORE parameterized routes
router.get('/missed-check-ins', teamLeadUpOrWhs,
  zValidator('query', getMissedCheckInsQuerySchema),
  missedCheckInController.getMissedCheckIns
);
router.patch('/missed-check-ins/:id', teamLeadUp,
  zValidator('json', updateMissedCheckInSchema),
  missedCheckInController.updateMissedCheckInStatus
);
router.get('/analytics', teamLeadUp, controller.getTeamAnalytics);
router.get('/check-in-history', teamLeadUpOrWhs, controller.getCheckInHistory);
router.get('/my-members', teamLeadUp, controller.getMyTeamMembers);

// Parameterized routes come AFTER specific routes
router.get('/:id', teamLeadUp, controller.getTeamById);
router.patch('/:id', adminOnly, zValidator('json', updateTeamSchema), controller.updateTeam);
router.get('/:id/members', teamLeadUp, controller.getTeamMembers);

export { router as teamRoutes };
```

### Admin Module (All Routes Same Role)
```typescript
const router = new Hono();

router.use('*', authMiddleware);
router.use('*', tenantMiddleware);
router.use('*', roleMiddleware(['ADMIN'])); // All routes require ADMIN

// Company Settings
router.get('/company/settings', controller.getCompanySettings);
router.patch('/company/settings', zValidator('json', updateSettingsSchema), controller.updateCompanySettings);

// Holidays (nested resource)
router.get('/holidays', controller.listHolidays);
router.post('/holidays', zValidator('json', createHolidaySchema), controller.createHoliday);
router.patch('/holidays/:id', zValidator('json', updateHolidaySchema), controller.updateHoliday);
router.delete('/holidays/:id', controller.deleteHoliday);

// Audit Logs
router.get('/audit-logs', controller.listAuditLogs);

export { router as adminRoutes };
```

### Module Without Role Restrictions (All Authenticated Users)
```typescript
const router = new Hono();

router.use('*', authMiddleware);
router.use('*', tenantMiddleware);
// No roleMiddleware - any authenticated user can access

router.post('/', zValidator('json', submitCheckInSchema), controller.submitCheckIn);
router.get('/today', controller.getTodayCheckIn);
router.get('/status', controller.getCheckInStatus);
router.get('/history', zValidator('query', getCheckInHistorySchema), controller.getCheckInHistory);
router.get('/:id', controller.getCheckInById);

export { router as checkInRoutes };
```

### Route Registration in app.ts
```typescript
// app.ts
import { Hono } from 'hono';
import { personRoutes } from './modules/person/person.routes';
import { teamRoutes } from './modules/team/team.routes';
import { checkInRoutes } from './modules/check-in/check-in.routes';

const app = new Hono();
const api = new Hono();

api.route('/persons', personRoutes);
api.route('/teams', teamRoutes);
api.route('/check-ins', checkInRoutes);

app.route('/api/v1', api);
```

### Common Role Groups Reference
| Group | Roles | Usage |
|-------|-------|-------|
| `adminOnly` | `['ADMIN']` | Management operations (create/update/delete entities) |
| `adminOrSupervisor` | `['ADMIN', 'SUPERVISOR']` | Viewing workers and teams |
| `teamLeadUp` | `['TEAM_LEAD', 'SUPERVISOR', 'ADMIN']` | Team-scoped operations |
| `teamLeadUpOrWhs` | `['TEAM_LEAD', 'SUPERVISOR', 'ADMIN', 'WHS']` | Team operations + WHS investigation |
| `whsUp` | `['WHS', 'SUPERVISOR', 'ADMIN']` | WHS and incident management |
| _(none)_ | All authenticated | Self-service (check-in, profile, notifications) |

## Rules
- ✅ DO apply `authMiddleware` + `tenantMiddleware` on ALL routes via `router.use('*')`
- ✅ DO define role groups as `const` variables for reuse
- ✅ DO use `zValidator('json', schema)` for body validation on `POST`/`PATCH`
- ✅ DO use `zValidator('query', schema)` for query parameter validation
- ✅ DO place specific routes BEFORE parameterized routes (`/analytics` before `/:id`)
- ✅ DO export with named export: `export { router as featureRoutes }`
- ✅ DO import controller as namespace: `import * as controller from './feature.controller'`
- ✅ DO import validators individually: `import { createSchema, updateSchema } from './feature.validator'`
- ❌ NEVER skip `authMiddleware` on protected routes
- ❌ NEVER skip `tenantMiddleware` (breaks multi-tenant isolation)
- ❌ NEVER skip validation on `POST`/`PATCH` routes
- ❌ NEVER put parameterized routes before specific routes (`:id` catches `/analytics`)
- ❌ NEVER use `default export` for routes (use named exports)
- ❌ NEVER apply role middleware to routes that should be accessible to all authenticated users

## Common Mistakes

### WRONG: Missing Auth/Tenant Middleware
```typescript
const router = new Hono();
// WRONG - no auth or tenant middleware
router.get('/', controller.listTeams);
router.post('/', controller.createTeam);
export { router as teamRoutes };
```

### CORRECT: Auth + Tenant on All Routes
```typescript
const router = new Hono();
router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

const adminOnly = roleMiddleware(['ADMIN']);
router.get('/', adminOnly, controller.listTeams);
router.post('/', adminOnly, zValidator('json', createTeamSchema), controller.createTeam);
export { router as teamRoutes };
```

### WRONG: Parameterized Route Before Specific Route
```typescript
const router = new Hono();
router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

// WRONG - /:id catches /analytics, /my-members, /check-in-history
router.get('/:id', controller.getTeamById);
router.get('/analytics', controller.getTeamAnalytics);    // Never reached
router.get('/my-members', controller.getMyTeamMembers);    // Never reached
```

### CORRECT: Specific Routes First
```typescript
const router = new Hono();
router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

// CORRECT - specific routes before parameterized
router.get('/analytics', teamLeadUp, controller.getTeamAnalytics);
router.get('/my-members', teamLeadUp, controller.getMyTeamMembers);
router.get('/:id', teamLeadUp, controller.getTeamById);
```

### WRONG: Missing Validation on Mutation
```typescript
// WRONG - no zValidator, raw unvalidated data reaches controller
router.post('/', adminOnly, controller.createTeam);
router.patch('/:id', adminOnly, controller.updateTeam);
```

### CORRECT: Validation Before Controller
```typescript
// CORRECT - input validated before controller executes
router.post('/', adminOnly, zValidator('json', createTeamSchema), controller.createTeam);
router.patch('/:id', adminOnly, zValidator('json', updateTeamSchema), controller.updateTeam);
```

### WRONG: Inline Role Arrays (Not Reusable)
```typescript
router.get('/', roleMiddleware(['TEAM_LEAD', 'SUPERVISOR', 'ADMIN']), controller.listTeams);
router.get('/analytics', roleMiddleware(['TEAM_LEAD', 'SUPERVISOR', 'ADMIN']), controller.getAnalytics);
router.get('/members', roleMiddleware(['TEAM_LEAD', 'SUPERVISOR', 'ADMIN']), controller.getMembers);
```

### CORRECT: Named Role Group Constants
```typescript
const teamLeadUp = roleMiddleware(['TEAM_LEAD', 'SUPERVISOR', 'ADMIN']);

router.get('/', teamLeadUp, controller.listTeams);
router.get('/analytics', teamLeadUp, controller.getAnalytics);
router.get('/members', teamLeadUp, controller.getMembers);
```
