# Team Context Pattern
> Role-based team filtering — ADMIN sees all, SUPERVISOR sees assigned, TEAM_LEAD sees own

## When to Use
- Dashboard controllers that show team-scoped data
- Analytics endpoints that filter by the user's assigned teams
- Any list/aggregation endpoint where results depend on the user's role and team assignments
- Missed check-in lists, team summaries, worker lists scoped by role

## Canonical Implementation

### getTeamContext — Role-Based Filter Resolution
```typescript
import { getTeamContext } from '../../shared/team-context';

export async function getDashboardStats(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const userRole = c.get('userRole') as string;
  const timezone = c.get('companyTimezone') as string;

  // Resolves team filter based on role — no extra DB query for ADMIN
  const { teamIds } = await getTeamContext(companyId, userId, userRole, timezone);

  const service = new DashboardService(prisma, companyId);
  const stats = await service.getStats(timezone, teamIds);

  return c.json({ success: true, data: stats });
}
```

### TeamContext Interface
```typescript
interface TeamContext {
  timezone: string;
  teamIds: string[] | null;
  // null    = no filter (ADMIN sees all) — skips DB query entirely
  // []      = no teams assigned (SUPERVISOR/TEAM_LEAD with no teams)
  // ["id"]  = specific teams (filtered results)
}
```

### Role Resolution Logic
| Role | teamIds | DB Query | What They See |
|------|---------|----------|---------------|
| `ADMIN` / `WHS` | `null` | None (skipped) | All teams in company |
| `SUPERVISOR` | `["id1", "id2"]` | `WHERE supervisor_id = userId` | Only assigned teams |
| `TEAM_LEAD` | `["id1"]` | `WHERE leader_id = userId` | Only their own team |

### Using teamIds in Service/Repository Queries
```typescript
// In service — apply filter conditionally
async getStats(timezone: string, teamIds: string[] | null) {
  // Build filter based on team context
  const teamFilter = teamIds
    ? { person: { team_id: { in: teamIds } } }
    : {};

  const [checkIns, workers] = await Promise.all([
    this.prisma.checkIn.findMany({
      where: {
        company_id: this.companyId,
        ...teamFilter,
      },
    }),
    this.prisma.person.findMany({
      where: {
        company_id: this.companyId,
        role: 'WORKER',
        is_active: true,
        ...(teamIds ? { team_id: { in: teamIds } } : {}),
      },
    }),
  ]);
}
```

## Rules
- ✅ **DO** call `getTeamContext()` in controllers for any team-scoped endpoint
- ✅ **DO** pass `teamIds` to service/repository methods — let them apply the filter
- ✅ **DO** handle `null` teamIds as "no filter" (ADMIN sees everything)
- ✅ **DO** handle empty array `[]` as "no teams" (show empty results, not all)
- ✅ **DO** only query active teams: `is_active: true` is built into `getTeamContext`
- ❌ **NEVER** skip team context for dashboard/analytics endpoints — it enforces role-based data isolation
- ❌ **NEVER** query teams separately in the controller when `getTeamContext()` already does it
- ❌ **NEVER** assume ADMIN needs a team filter — `null` means no filtering needed

## Common Mistakes

### WRONG: Fetching teams separately in controller
```typescript
export async function getDashboard(c: Context): Promise<Response> {
  const userRole = c.get('userRole') as string;
  const userId = c.get('userId') as string;

  // WRONG — duplicates what getTeamContext() already does
  let teamIds: string[] | undefined;
  if (userRole === 'TEAM_LEAD') {
    const teams = await prisma.team.findMany({ where: { leader_id: userId } });
    teamIds = teams.map(t => t.id);
  }
  // ...
}
```

### CORRECT: Use getTeamContext
```typescript
export async function getDashboard(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const userRole = c.get('userRole') as string;
  const timezone = c.get('companyTimezone') as string;

  // CORRECT — handles all roles, skips DB for ADMIN
  const { teamIds } = await getTeamContext(companyId, userId, userRole, timezone);
  const service = new DashboardService(prisma, companyId);
  const stats = await service.getStats(timezone, teamIds);

  return c.json({ success: true, data: stats });
}
```

### WRONG: Treating null teamIds as empty array
```typescript
async getStats(teamIds: string[] | null) {
  // WRONG — null means "no filter", not "no teams"
  const workers = await this.prisma.person.findMany({
    where: {
      company_id: this.companyId,
      team_id: { in: teamIds ?? [] }, // Shows nothing for ADMIN!
    },
  });
}
```

### CORRECT: Conditional filter based on null
```typescript
async getStats(teamIds: string[] | null) {
  // CORRECT — null = no filter (ADMIN), array = filter by teams
  const workers = await this.prisma.person.findMany({
    where: {
      company_id: this.companyId,
      ...(teamIds ? { team_id: { in: teamIds } } : {}),
    },
  });
}
```
