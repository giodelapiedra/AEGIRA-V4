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
