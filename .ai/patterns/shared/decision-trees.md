# Decision Trees
> When to use what - service layer, stale times, keepPreviousData, transactions, custom hooks

## When to Use
- When deciding on the architecture for a new feature or endpoint
- When unsure about the correct pattern for a specific situation
- When reviewing code for pattern compliance

## Canonical Implementation

### Decision 1: When to Add a Service Layer

```
Does the controller need to...
├── Use multiple repositories?
│   └── YES → Add service layer
├── Perform complex calculations?
│   └── YES → Add service layer
├── Run a database transaction?
│   └── YES → Add service layer
├── Coordinate multiple side effects?
│   └── YES → Add service layer
└── Just do simple CRUD?
    └── NO service layer → Controller calls Repository directly
```

**Examples:**

| Operation | Service Needed? | Why |
|-----------|----------------|-----|
| List teams | No | Simple query, one repository |
| Create person | No | Single insert, one repository |
| Submit check-in | Yes | Readiness calculation + eligibility check + create |
| Assign team members | Yes | Multiple repos (team + person) + transaction |
| Process incident | Yes | Create incident + create case + notify + audit |
| Get person by ID | No | Simple query, one repository |
| Delete team | No | Single operation, one repository |
| Generate dashboard stats | Yes | Multiple repos + aggregation + calculations |

```typescript
// NO service: controller → repository directly
export async function list(c: Context) {
  const companyId = c.get('companyId') as string;
  const repo = new TeamRepository(c.get('prisma'), companyId);
  const result = await repo.findAll(page, limit);
  return c.json({ success: true, data: paginate(result.items, page, limit, result.total) });
}

// YES service: controller → service → repository
export async function submitCheckIn(c: Context) {
  const companyId = c.get('companyId') as string;
  const service = new CheckInService(c.get('prisma'), companyId);
  const result = await service.submitCheckIn(userId, body);
  return c.json({ success: true, data: result }, 201);
}
```

---

### Decision 2: Which Stale Time

```
How often does this data change?
├── Every few seconds (live metrics, notifications, dashboard)
│   └── REALTIME (30s)
├── Every few minutes (team lists, person lists, detail pages)
│   └── STANDARD (2m)
├── Rarely changes (analytics, company settings, historical data)
│   └── STATIC (10m)
└── Basically never changes (holidays, reference data, immutable records)
    └── IMMUTABLE (30m)
```

| Data Type | Stale Time | Constant | Duration |
|-----------|-----------|----------|----------|
| Dashboard stats (WHS, Admin) | `REALTIME` | `STALE_TIMES.REALTIME` | 30 seconds |
| Notification list/count | `REALTIME` | `STALE_TIMES.REALTIME` | 30 seconds |
| Check-in status | `REALTIME` | `STALE_TIMES.REALTIME` | 30 seconds |
| Team list | `STANDARD` | `STALE_TIMES.STANDARD` | 2 minutes |
| Person list/detail | `STANDARD` | `STALE_TIMES.STANDARD` | 2 minutes |
| Incident list | `STANDARD` | `STALE_TIMES.STANDARD` | 2 minutes |
| WHS analytics (period-based) | `STATIC` | `STALE_TIMES.STATIC` | 10 minutes |
| Company settings | `STATIC` | `STALE_TIMES.STATIC` | 10 minutes |
| Check-in history | `IMMUTABLE` | `STALE_TIMES.IMMUTABLE` | 30 minutes |
| Audit logs | `IMMUTABLE` | `STALE_TIMES.IMMUTABLE` | 30 minutes |
| Holidays | `IMMUTABLE` | `STALE_TIMES.IMMUTABLE` | 30 minutes |

```typescript
// Import from config
import { STALE_TIMES } from '@/config/query.config';

// NEVER hardcode values
staleTime: STALE_TIMES.REALTIME,   // 30_000
staleTime: STALE_TIMES.STANDARD,   // 120_000
staleTime: STALE_TIMES.STATIC,     // 600_000
staleTime: STALE_TIMES.IMMUTABLE,  // 1_800_000
```

---

### Decision 3: When to Use keepPreviousData

```
Does the query have parameters that change frequently?
├── Paginated list? (page, limit change)
│   └── YES → Use keepPreviousData
├── Search/filter changes? (debounced search string)
│   └── YES → Use keepPreviousData
├── Period selector? (7d, 30d, 90d)
│   └── YES → Use keepPreviousData
├── Tab-based filtering?
│   └── YES → Use keepPreviousData
└── Single entity by ID? (detail page)
    └── NO → Don't use keepPreviousData
```

```typescript
import { keepPreviousData } from '@tanstack/react-query';

// Paginated list → YES
export function useTeams(page: number, limit: number, search: string) {
  return useQuery({
    queryKey: ['teams', page, limit, search],
    staleTime: STALE_TIMES.STANDARD,
    placeholderData: keepPreviousData, // Smooth page transitions
    queryFn: async () => { /* ... */ },
  });
}

// Period-based analytics → YES
export function useWhsAnalytics(period: AnalyticsPeriod) {
  return useQuery({
    queryKey: ['analytics', 'whs', period],
    staleTime: STALE_TIMES.STATIC,
    placeholderData: keepPreviousData, // Smooth period switching
    queryFn: async () => { /* ... */ },
  });
}

// Single entity detail → NO
export function useTeam(teamId: string) {
  return useQuery({
    queryKey: ['team', teamId],
    staleTime: STALE_TIMES.STANDARD,
    enabled: !!teamId,
    // NO keepPreviousData — different entity entirely
    queryFn: async () => { /* ... */ },
  });
}
```

---

### Decision 4: When to Use Database Transactions

```
Does the operation...
├── Write to multiple tables?
│   └── YES → Use $transaction
├── Need atomicity (all-or-nothing)?
│   └── YES → Use $transaction
├── Read-then-write with consistency needs?
│   └── YES → Use $transaction
└── Single table insert/update/delete?
    └── NO → No transaction needed
```

```typescript
// SINGLE table operation → No transaction
async create(data: CreateTeamInput): Promise<Team> {
  return this.prisma.team.create({
    data: this.withCompany({ name: data.name }),
  });
}

// MULTI-table operation → Use transaction
async assignMembers(teamId: string, memberIds: string[]): Promise<void> {
  await this.prisma.$transaction(async (tx) => {
    // Verify team exists
    const team = await tx.team.findFirst({
      where: { id: teamId, company_id: this.companyId },
    });
    if (!team) throw Errors.notFound('Team');

    // Update all persons' team_id
    await tx.person.updateMany({
      where: {
        id: { in: memberIds },
        company_id: this.companyId,
      },
      data: { team_id: teamId },
    });
  });
}
```

---

### Decision 5: When to Extract Custom Hooks

```
Is the logic...
├── Used in 2+ components?
│   └── YES → Extract to shared hook
├── Complex state management (multiple useState + useEffect)?
│   └── YES → Extract to feature hook
├── API data fetching?
│   └── YES → ALWAYS create a query/mutation hook
├── Simple one-liner (single useState)?
│   └── NO → Keep inline in component
└── Business logic calculation?
    └── YES → Extract to utility function (not hook)
```

```typescript
// ALWAYS: API hooks in features/<feature>/hooks/
// useTeams.ts, useCreateTeam.ts, useWhsAnalytics.ts

// SHARED: Reusable behavior across features
// lib/hooks/use-debounce.ts, lib/hooks/use-toast.ts

// INLINE: Simple component-local state
const [isOpen, setIsOpen] = useState(false);  // Keep inline, don't extract

// UTILITY: Pure computation (not a hook)
// lib/utils/format.utils.ts → formatPercentage(value)
// lib/utils/date.utils.ts → formatRelativeTime(date)
```

---

### Decision 6: Where to Put Types

```
Is the type...
├── Used by multiple features?
│   └── src/types/<domain>.types.ts
├── Used only in one feature's hooks?
│   └── Co-locate in the hook file, re-export
├── A Zod schema inferred type (backend)?
│   └── Export from <feature>.validator.ts
├── Component props?
│   └── Define inline in the component file
└── API response shape?
    └── src/types/<domain>.types.ts
```

## Rules
- ✅ DO add a service layer when there are multi-repo operations, calculations, or transactions
- ✅ DO use the stale time constant that matches the data's update frequency
- ✅ DO use `keepPreviousData` for any query with user-controlled parameters (pagination, search, filters, period)
- ✅ DO use `$transaction` for multi-table writes that must be atomic
- ✅ DO extract API hooks for ALL data fetching (never inline `useQuery` in components)
- ✅ DO put shared types in `src/types/`, feature-local types in hook files
- ❌ NEVER create a service layer for simple CRUD (just proxies to repository)
- ❌ NEVER hardcode stale time values (always use `STALE_TIMES` constants)
- ❌ NEVER use `keepPreviousData` for single-entity detail queries
- ❌ NEVER skip transactions for multi-table write operations
- ❌ NEVER put business logic in utility functions that should be hooks (anything using React state/effects)

## Common Mistakes

### ❌ WRONG: Unnecessary service layer
```typescript
// Service that just proxies to repository — add no value
export class TeamService {
  async findAll(page: number, limit: number) {
    const repo = new TeamRepository(this.prisma, this.companyId);
    return repo.findAll(page, limit); // Just proxying!
  }
}
```

### ✅ CORRECT: Skip service for simple CRUD
```typescript
// Controller calls repository directly
export async function list(c: Context) {
  const companyId = c.get('companyId') as string;
  const repo = new TeamRepository(c.get('prisma'), companyId);
  const { items, total } = await repo.findAll(page, limit);
  return c.json({ success: true, data: paginate(items, page, limit, total) });
}
```

### ❌ WRONG: keepPreviousData on detail query
```typescript
export function useTeam(teamId: string) {
  return useQuery({
    queryKey: ['team', teamId],
    placeholderData: keepPreviousData, // WRONG: shows Team A data while loading Team B
    queryFn: () => apiClient.get<Team>(ENDPOINTS.TEAM.BY_ID(teamId)),
  });
}
```

### ✅ CORRECT: No keepPreviousData on detail queries
```typescript
export function useTeam(teamId: string) {
  return useQuery({
    queryKey: ['team', teamId],
    staleTime: STALE_TIMES.STANDARD,
    enabled: !!teamId,
    // No keepPreviousData — each entity is distinct
    queryFn: () => apiClient.get<Team>(ENDPOINTS.TEAM.BY_ID(teamId)),
  });
}
```
