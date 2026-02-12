# API Response Format
> Standard response envelope - success/paginated/error formats with apiClient unwrapping

## When to Use
- Every backend endpoint response
- Every frontend API call
- Understanding how data flows from backend to frontend hooks

## Response Formats

### Success Response
```typescript
// Backend controller
return c.json({
  success: true,
  data: team,  // T
});
```

### Paginated Response
```typescript
import { parsePagination, paginate } from '../../shared/pagination.utils.js';

export async function list(c: Context) {
  const { page, limit } = parsePagination(c.req.query());
  const repo = new TeamRepository(c.get('prisma'), c.get('companyId'));
  const { items, total } = await repo.findAll(page, limit);

  return c.json({
    success: true,
    data: paginate(items, page, limit, total),
  });
}

// Response shape:
{
  success: true,
  data: {
    items: T[],
    pagination: {
      page: number,
      limit: number,
      total: number,
      totalPages: number
    }
  }
}
```

### Error Response
```typescript
// Thrown via AppError
throw new AppError('TEAM_NOT_FOUND', 'Team not found', 404);

// Response shape:
{
  success: false,
  error: {
    code: 'TEAM_NOT_FOUND',
    message: 'Team not found'
  }
}
```

## Frontend API Client

The `apiClient` singleton automatically unwraps `response.data`:

```typescript
// Frontend apiClient internals
class APIClient {
  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      credentials: 'include',  // httpOnly cookies
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Request failed');
    }

    const json = await response.json();
    return json.data;  // ← Unwraps automatically
  }
}
```

### What Hooks Receive

```typescript
// Hooks receive T directly, NOT { success, data }
const { data } = useTeams();
// data = { items: Team[], pagination: {...} }
// NOT: { success: true, data: { items: [...] } }

const { data: team } = useTeam(teamId);
// team = { id, name, ... }
// NOT: { success: true, data: { id, name, ... } }
```

## ENDPOINTS Constants

```typescript
// src/lib/api/endpoints.ts
export const ENDPOINTS = {
  TEAM: {
    LIST: '/teams',
    DETAIL: (id: string) => `/teams/${id}`,
    CREATE: '/teams',
    UPDATE: (id: string) => `/teams/${id}`,
    DELETE: (id: string) => `/teams/${id}`,
    MEMBERS: (id: string) => `/teams/${id}/members`,
  },
  PERSON: {
    LIST: '/persons',
    DETAIL: (id: string) => `/persons/${id}`,
    // ...
  },
  DASHBOARD: {
    WHS_DASHBOARD: '/dashboard/whs',
    WHS_ANALYTICS: '/dashboard/whs/analytics',
  },
  // ...
} as const;
```

## Pagination Utilities

### Backend: parsePagination

```typescript
import { parsePagination } from '../../shared/pagination.utils.js';

const { page, limit } = parsePagination(c.req.query());
// Clamps: page min 1, max 10000; limit min 1, max 100
// Defaults: page = 1, limit = 20
```

### Backend: paginate

```typescript
import { paginate } from '../../shared/pagination.utils.js';

// paginate(items, page, limit, total) returns:
{
  items: T[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number  // Math.ceil(total / limit)
  }
}
```

### Frontend: Using Paginated Data

```typescript
export function TeamsPage() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,  // TanStack Table is 0-indexed
    pageSize: 20,
  });

  const { data } = useTeams(
    pagination.pageIndex + 1,  // API is 1-indexed
    pagination.pageSize
  );

  return (
    <DataTable
      columns={columns}
      data={data?.items ?? []}
      pageCount={data?.pagination?.totalPages}
      pagination={pagination}
      onPaginationChange={setPagination}
    />
  );
}
```

## Rules

- ✅ DO always return `{ success: true, data: T }` from backend
- ✅ DO use `paginate()` for all list endpoints
- ✅ DO use `parsePagination()` to clamp page/limit values
- ✅ DO use ENDPOINTS constants in frontend (never hardcode URLs)
- ✅ DO use `apiClient.get<T>()` with generic type parameter
- ✅ DO handle the automatic unwrapping (hooks receive `T`, not `{ success, data }`)
- ❌ NEVER hardcode API URLs: `apiClient.get('/api/v1/teams')` is WRONG
- ❌ NEVER manually build query strings: use `URLSearchParams`
- ❌ NEVER access `response.data.data` (apiClient already unwraps once)
- ❌ NEVER return non-standard response shapes from backend
- ❌ NEVER expose internal error details in error responses

## Common Mistakes

### ❌ WRONG: Hardcoded URL
```typescript
const { data } = useQuery({
  queryFn: () => apiClient.get('/api/v1/teams?page=1&limit=20'),
});
```

### ✅ CORRECT: ENDPOINTS + URLSearchParams
```typescript
const { data } = useQuery({
  queryFn: () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    return apiClient.get<PaginatedResponse<Team>>(
      `${ENDPOINTS.TEAM.LIST}?${params.toString()}`
    );
  },
});
```

### ❌ WRONG: Double unwrapping
```typescript
const { data } = useTeams();
const teams = data?.data?.items;  // WRONG - double .data
```

### ✅ CORRECT: Single level
```typescript
const { data } = useTeams();
const teams = data?.items;  // CORRECT - apiClient already unwrapped
```
