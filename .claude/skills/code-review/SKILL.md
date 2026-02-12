---
name: code-review
description: Review code against AEGIRA patterns and rules. Use when you want to verify if code follows the established conventions, check for security issues, or validate before committing.
---
# Code Review

Review code against AEGIRA patterns and provide actionable feedback.

## Usage

```
/code-review [file paths or feature name]
```

Examples:
```
/code-review src/modules/schedule/
/code-review src/features/holiday/
/code-review the new incident feature I just created
```

## Security Checklist

<!-- BUILT FROM: .ai/patterns/shared/security-checklist.md -->
# Security Checklist
> Pre-submission security verification - multi-tenant isolation, auth, sensitive data, validation, OWASP

## When to Use
- Before submitting any PR that touches backend code
- When reviewing code changes for security issues
- When creating new modules, endpoints, or database queries
- When handling user input, authentication, or authorization

## Canonical Implementation

### 1. Multi-Tenant Isolation (CRITICAL)

Every database query MUST be scoped by `company_id`. This is the most critical security requirement.

```typescript
// BaseRepository pattern enforces this automatically
export abstract class BaseRepository {
  constructor(
    protected readonly prisma: PrismaClient,
    protected readonly companyId: string
  ) {}

  protected where<T extends Record<string, unknown>>(
    conditions: T
  ): T & { company_id: string } {
    return { ...conditions, company_id: this.companyId };
  }

  protected withCompany<T extends Record<string, unknown>>(
    data: T
  ): T & { company_id: string } {
    return { ...data, company_id: this.companyId };
  }
}
```

**Checklist:**
- [ ] Every `findMany` / `findFirst` uses `this.where()` (adds `company_id`)
- [ ] Every `create` uses `this.withCompany()` (sets `company_id`)
- [ ] Every `update` includes `company_id` in the WHERE clause
- [ ] Every `delete` includes `company_id` in the WHERE clause
- [ ] `company_id` is NEVER taken from the request body (always from `c.get('companyId')`)
- [ ] `findUnique` is NEVER used (does not support composite `company_id` filtering)

```typescript
// ✅ CORRECT: company_id from auth context
const companyId = c.get('companyId') as string;
const repo = new PersonRepository(prisma, companyId);

// ❌ WRONG: company_id from request body
const { companyId } = await c.req.json(); // NEVER trust client
```

---

### 2. Authentication & Authorization

**Checklist:**
- [ ] All routes use `authMiddleware` via `router.use('*', authMiddleware)`
- [ ] All routes use `tenantMiddleware` via `router.use('*', tenantMiddleware)`
- [ ] Role-restricted endpoints use `roleMiddleware(['ADMIN', ...])` BEFORE the controller
- [ ] User identity is extracted from context, not from request: `c.get('userId')`, `c.get('userRole')`
- [ ] JWT token is validated in auth middleware (not in controllers)
- [ ] Token is stored in httpOnly cookie (not localStorage)

```typescript
// Route setup
const router = new Hono();
router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

const adminOnly = roleMiddleware(['ADMIN']);
const supervisorUp = roleMiddleware(['ADMIN', 'SUPERVISOR']);

router.get('/', supervisorUp, controller.list);
router.post('/', adminOnly, zValidator('json', createSchema), controller.create);
```

---

### 3. Sensitive Data Protection

**Checklist:**
- [ ] `SAFE_PERSON_SELECT` is used for all person queries that return to the client
- [ ] `password_hash` is NEVER included in API responses
- [ ] `reset_token` and `reset_token_expires` are NEVER included in API responses
- [ ] Passwords are hashed with bcrypt (12 rounds) before storage
- [ ] Sensitive fields are NEVER logged (password, tokens, secrets)
- [ ] Error messages do not expose internal details (stack traces, SQL queries)

```typescript
// SAFE_SELECT pattern
export const SAFE_PERSON_SELECT = {
  id: true,
  first_name: true,
  last_name: true,
  email: true,
  role: true,
  phone_number: true,
  team_id: true,
  is_active: true,
  created_at: true,
  updated_at: true,
  // EXCLUDED: password_hash, reset_token, reset_token_expires
} as const;

// Usage in repository
async findAll(page: number, limit: number) {
  return this.prisma.person.findMany({
    where: this.where({ is_active: true }),
    select: SAFE_PERSON_SELECT, // Never return password
  });
}

// Auth-only queries (internal, never returned to client)
async findByEmail(email: string) {
  return this.prisma.person.findFirst({
    where: this.where({ email }),
    // Full model returned for password verification ONLY
  });
}
```

---

### 4. Input Validation

**Checklist:**
- [ ] Every POST/PATCH/PUT endpoint has a Zod schema via `zValidator('json', schema)`
- [ ] Query parameters are validated for list endpoints: `zValidator('query', listSchema)`
- [ ] Path parameters are validated: `zValidator('param', idSchema)`
- [ ] String fields use `.trim()` to prevent whitespace-only values
- [ ] Email fields use `.trim().toLowerCase()` for normalization
- [ ] Numeric inputs are bounded (min/max)
- [ ] Arrays have max length limits
- [ ] UUIDs are validated with `.uuid()`

```typescript
// Comprehensive validation schema
export const createPersonSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['WORKER', 'TEAM_LEAD', 'SUPERVISOR', 'ADMIN']).default('WORKER'),
  teamId: z.string().uuid().optional(),
});

// Route with validation BEFORE controller
router.post(
  '/',
  adminOnly,
  zValidator('json', createPersonSchema),
  controller.create
);
```

---

### 5. Error Message Safety

**Checklist:**
- [ ] AppError messages are user-friendly (no SQL, no stack traces)
- [ ] Global error handler catches unexpected errors and returns generic 500
- [ ] Validation errors return specific field messages (from Zod)
- [ ] Not-found errors use generic messages: "Team not found" (not "Team with id abc-123 in company xyz-456 not found")
- [ ] Auth errors use vague messages: "Invalid credentials" (not "Password incorrect for user X")

```typescript
// ✅ CORRECT: Generic, safe error messages
throw Errors.notFound('Team');           // "Team not found" (404)
throw Errors.unauthorized();             // "Unauthorized" (401)
throw Errors.forbidden('Access denied'); // "Access denied" (403)

// ❌ WRONG: Exposing internals
throw new Error(`Team ${id} not found in company ${companyId}`); // Leaks company ID
throw new Error(`SQL error: duplicate key on person.email`);      // Leaks schema
```

---

### 6. SQL Injection Prevention

**Checklist:**
- [ ] ALL database queries use Prisma's parameterized queries (never raw SQL strings)
- [ ] If `$queryRaw` is used, it uses tagged template literals (never string interpolation)
- [ ] Search filters use Prisma's `contains` / `startsWith` operators (not raw LIKE)

```typescript
// ✅ CORRECT: Prisma parameterized queries
await this.prisma.person.findMany({
  where: this.where({
    OR: [
      { first_name: { contains: query, mode: 'insensitive' } },
      { last_name: { contains: query, mode: 'insensitive' } },
    ],
  }),
});

// ✅ CORRECT: Tagged template literal for raw queries (if absolutely needed)
await this.prisma.$queryRaw`SELECT * FROM person WHERE company_id = ${companyId}`;

// ❌ WRONG: String interpolation in raw queries
await this.prisma.$queryRawUnsafe(`SELECT * FROM person WHERE name = '${name}'`);
```

---

### 7. XSS Prevention (Frontend)

**Checklist:**
- [ ] All user-provided content is rendered via React JSX (auto-escapes HTML)
- [ ] `dangerouslySetInnerHTML` is NEVER used
- [ ] URLs from user input are validated before use in `href` attributes
- [ ] User content in attributes uses JSX binding: `value={userInput}` (not string templates)

```tsx
// ✅ CORRECT: React auto-escapes
<p>{person.first_name}</p>
<td>{incident.description}</td>

// ❌ WRONG: Dangerous HTML injection
<div dangerouslySetInnerHTML={{ __html: userContent }} />
```

---

### 8. CSRF Protection

**Checklist:**
- [ ] Auth tokens are stored in httpOnly cookies (not localStorage)
- [ ] Cookies use `SameSite=Lax` or `SameSite=Strict`
- [ ] `credentials: 'include'` is set on API client fetch calls
- [ ] CORS is configured to allow only the frontend origin

---

### 9. Ownership Verification Pattern

For operations where a user should only access their own data or their team's data.

```typescript
// Verify the current user owns the resource
export async function updateProfile(c: Context) {
  const userId = c.get('userId') as string;
  const companyId = c.get('companyId') as string;

  const repo = new PersonRepository(prisma, companyId);
  const person = await repo.findById(userId); // Scoped by company_id

  if (!person) throw Errors.notFound('Person');

  // Update only the authenticated user's own profile
  return repo.update(userId, body);
}

// Team-scoped access for team leads
export async function listMyTeamMembers(c: Context) {
  const userId = c.get('userId') as string;
  const companyId = c.get('companyId') as string;

  // Verify user is lead of the team they're accessing
  const teamContext = await getTeamContext(prisma, companyId, userId);
  if (!teamContext) throw Errors.forbidden('You are not assigned to any team');

  const repo = new PersonRepository(prisma, companyId);
  return repo.findByTeam(teamContext.teamId, page, limit);
}
```

## Rules
- ✅ DO extend `BaseRepository` for all repositories (enforces multi-tenant isolation)
- ✅ DO use `this.where()` for ALL read queries
- ✅ DO use `this.withCompany()` for ALL create operations
- ✅ DO use `SAFE_PERSON_SELECT` for ALL person queries returned to the client
- ✅ DO validate ALL inputs with Zod schemas on routes
- ✅ DO use `AppError` with safe, user-friendly messages
- ✅ DO use Prisma parameterized queries for ALL database operations
- ✅ DO use httpOnly cookies for auth tokens
- ✅ DO verify ownership for user-specific operations
- ❌ NEVER trust `company_id` from request body (always from auth context)
- ❌ NEVER use `findUnique` (does not support compound company_id filtering)
- ❌ NEVER return `password_hash`, `reset_token`, or other sensitive fields in API responses
- ❌ NEVER log passwords, tokens, or other secrets
- ❌ NEVER expose internal error details (SQL errors, stack traces) in API responses
- ❌ NEVER use `$queryRawUnsafe` or string interpolation in raw SQL
- ❌ NEVER use `dangerouslySetInnerHTML` in React components
- ❌ NEVER skip validation middleware on routes

## Common Mistakes

### ❌ WRONG: Missing company_id filter
```typescript
async findAll(page: number, limit: number) {
  // Returns ALL companies' data!
  return this.prisma.team.findMany({
    skip: (page - 1) * limit,
    take: limit,
  });
}
```

### ✅ CORRECT: Always use this.where()
```typescript
async findAll(page: number, limit: number) {
  const where = this.where({ is_active: true }); // Includes company_id
  return this.prisma.team.findMany({ where, skip: (page - 1) * limit, take: limit });
}
```

### ❌ WRONG: Returning password in API response
```typescript
async findById(id: string) {
  // Returns password_hash!
  return this.prisma.person.findFirst({
    where: this.where({ id }),
  });
}
```

### ✅ CORRECT: Use SAFE_SELECT
```typescript
async findById(id: string) {
  return this.prisma.person.findFirst({
    where: this.where({ id }),
    select: SAFE_PERSON_SELECT, // Excludes sensitive fields
  });
}
```

### ❌ WRONG: Trusting client-provided company_id
```typescript
export async function create(c: Context) {
  const body = await c.req.json();
  // BAD: company_id from client request
  const repo = new TeamRepository(prisma, body.companyId);
  return repo.create(body);
}
```

### ✅ CORRECT: Company ID from auth context
```typescript
export async function create(c: Context) {
  const companyId = c.get('companyId') as string; // From auth middleware
  const body = c.req.valid('json');
  const repo = new TeamRepository(prisma, companyId);
  return repo.create(body);
}
```


## Code Review Checklist

<!-- BUILT FROM: .ai/patterns/shared/code-review.md -->
# Code Review Checklist
> PR review criteria - security, types, patterns, performance, code quality

## When to Use
- Every PR review
- Self-review before submitting code
- Validating AI-generated code

## Critical Checks (Must Pass)

### Multi-Tenant Isolation
```typescript
// ✅ CORRECT - Uses where() helper
where: this.where({ id: teamId })

// ❌ WRONG - Missing company_id filter
where: { id: teamId }
```

### No Direct Prisma in Controllers
```typescript
// ✅ CORRECT - Uses repository
const repo = new TeamRepository(prisma, companyId);
const team = await repo.findById(teamId);

// ❌ WRONG - Direct Prisma in controller
const team = await prisma.team.findFirst({ where: { id: teamId } });
```

### Auth Middleware Applied
```typescript
// ✅ CORRECT - All routes protected
teamRoutes.use('*', authMiddleware);
teamRoutes.use('*', tenantMiddleware);

// ❌ WRONG - Missing middleware
teamRoutes.get('/public', controller.list);
```

### No `any` Types
```typescript
// ✅ CORRECT - Explicit types
function processData(data: TeamData): ProcessedResult { ... }

// ❌ WRONG - any type
function processData(data: any): any { ... }
```

### Sensitive Fields Excluded
```typescript
// ✅ CORRECT - SAFE_SELECT
const person = await this.prisma.person.findFirst({
  select: SAFE_PERSON_SELECT,
});

// ❌ WRONG - Returns password_hash
const person = await this.prisma.person.findFirst({ where: { id } });
return c.json({ success: true, data: person });
```

## Standard Checks (Should Pass)

### Zod Validation on All Routes
```typescript
// ✅ CORRECT
teamRoutes.post('/', zValidator('json', createTeamSchema), controller.create);

// ❌ WRONG - No validation
teamRoutes.post('/', controller.create);
```

### QueryKey Completeness
```typescript
// ✅ CORRECT - All params in queryKey
queryKey: ['teams', page, limit, search]

// ❌ WRONG - Missing search
queryKey: ['teams', page, limit]
```

### Stale Time from Constants
```typescript
// ✅ CORRECT
staleTime: STALE_TIMES.STANDARD

// ❌ WRONG - Magic number
staleTime: 60000
```

### Mutation Invalidation
```typescript
// ✅ CORRECT - Invalidates related queries
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['teams'] });
  queryClient.invalidateQueries({ queryKey: ['team', teamId] });
}

// ❌ WRONG - No invalidation
onSuccess: () => {}
```

### PageLoader Wrapping
```typescript
// ✅ CORRECT
<PageLoader isLoading={isLoading} error={error} skeleton="table">
  {/* content */}
</PageLoader>

// ❌ WRONG - No error handling
{isLoading ? <Spinner /> : <Content />}
```

### Safe Data Access
```typescript
// ✅ CORRECT
data={data?.items ?? []}

// ❌ WRONG - Crashes if undefined
data={data.items}
```

### Column Definitions Outside Component
```typescript
// ✅ CORRECT - Outside component
const columns: ColumnDef<Team>[] = [...];

// ❌ WRONG - Inside component (re-renders)
export function Page() {
  const columns = [...];
}
```

### Form Error Handling
```typescript
// ✅ CORRECT - mutateAsync + try/catch
try {
  await mutation.mutateAsync(data);
  toast({ title: 'Success' });
  navigate(ROUTES.LIST);
} catch (error) {
  toast({
    title: 'Error',
    description: error instanceof Error ? error.message : 'Failed',
    variant: 'destructive',
  });
}
```

## Performance Checks

### N+1 Query Prevention
```typescript
// ✅ CORRECT - Eager loading
const teams = await prisma.team.findMany({
  include: { leader: true, members: true },
});

// ❌ WRONG - N+1
for (const team of teams) {
  const leader = await prisma.person.findUnique({ ... });
}
```

### Parallel Queries
```typescript
// ✅ CORRECT
const [items, total] = await Promise.all([
  prisma.team.findMany({ where }),
  prisma.team.count({ where }),
]);

// ❌ WRONG - Sequential
const items = await prisma.team.findMany({ where });
const total = await prisma.team.count({ where });
```

### Memoization
```typescript
// ✅ CORRECT
const handleClick = useCallback(() => { ... }, [deps]);
const columns = useMemo(() => getColumns(handleClick), [handleClick]);
```

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Backend files | kebab-case | `team-member.routes.ts` |
| Frontend pages | PascalCase | `TeamsPage.tsx` |
| Frontend hooks | camelCase | `useTeams.ts` |
| Types/Interfaces | PascalCase | `TeamMember` |
| Constants | UPPER_SNAKE_CASE | `STALE_TIMES` |
| DB columns | snake_case | `created_at` |

## Review Priority Order

1. **Security** - multi-tenant, auth, sensitive data
2. **Type safety** - no `any`, proper interfaces
3. **Pattern compliance** - repository, hooks, error handling
4. **Performance** - N+1, memoization, parallel queries
5. **Code quality** - naming, organization

## Automated Checks (Before Manual Review)

```bash
npm run typecheck    # TypeScript check
npm run lint         # ESLint
npm run test:run     # Tests
npm run build        # Build verification
```


## Review Output Format

```markdown
# Code Review: [Feature Name]

## Summary
- Total files reviewed: X
- Issues found: X (Critical: X, High: X, Medium: X, Low: X)
- Overall: PASS / NEEDS CHANGES

## Critical Issues
1. **[File:Line]** - Description
   - Current: `code snippet`
   - Should be: `correct code`

## High Priority Issues
...

## Medium Priority Issues
...

## Low Priority / Suggestions
...

## What's Good
- List of things done correctly
```

## Quick Commands

After review, common fixes:

| Issue | Fix Command |
|-------|-------------|
| Missing query invalidation | Add `queryClient.invalidateQueries()` in onSuccess |
| Columns inside component | Move columns definition outside component |
| Direct Prisma in controller | Create/use repository method |
| Missing company_id filter | Use `this.where()` helper |
| Hardcoded URL | Replace with `ENDPOINTS.X.Y` constant |
| Missing PageLoader | Wrap page content with `<PageLoader>` |
