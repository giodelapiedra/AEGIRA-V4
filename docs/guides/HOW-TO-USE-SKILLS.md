# How to Use AEGIRA Skills & Rules

> Guide para sa developers at AI agents kung paano gamitin ang skills at rules ng AEGIRA.

## Quick Start

### Option 1: Use Slash Commands (Skills)

```bash
# Backend
/backend-crud-module     # Complete CRUD module (routes, controller, repo, validator)
/backend-service         # Add service layer for complex logic

# Frontend
/query-hooks             # Generate useQuery hooks
/mutation-hooks          # Generate useMutation hooks
/data-table-page         # List page with DataTable + pagination
/form-component          # Create/Edit form pages
/dashboard-page          # Role-specific dashboard
/analytics-page          # Charts with period selector

# Review
/code-review             # Review code against AEGIRA patterns
```

### Option 2: Natural Language

Just describe what you need:

```
Gumawa ng Team Management feature na may:
- List page with search and pagination
- Create/Edit forms
- Backend CRUD API

Sundin mo yung patterns sa codebase.
```

---

## Documentation Structure

```
aegira-frontend/
├── .claude/
│   ├── rules/                    # Auto-applied rules
│   │   ├── general.mdc           # Critical rules (multi-tenant, TypeScript)
│   │   ├── frontend.mdc          # Frontend patterns
│   │   └── backend.mdc           # Backend patterns
│   └── skills/                   # Code generation templates
│       ├── query-hooks/
│       ├── mutation-hooks/
│       ├── data-table-page/
│       ├── form-component/
│       ├── dashboard-page/
│       ├── analytics-page/
│       ├── backend-crud-module/
│       ├── backend-service/
│       └── code-review/          # Review code against patterns
├── docs/
│   ├── README.md                 # Navigation guide
│   ├── HOW-TO-USE-SKILLS.md      # This file
│   ├── ai-agent-guidelines/      # Complete AI agent rules
│   │   ├── README.md             # Overview + critical rules
│   │   ├── 01-architecture-rules.md
│   │   ├── 02-backend-patterns.md
│   │   ├── 03-frontend-patterns.md
│   │   ├── 04-decision-trees.md  # When to use what
│   │   ├── 05-security-checklist.md
│   │   ├── 06-testing-patterns.md
│   │   ├── 07-error-handling.md
│   │   └── 08-code-review-checklist.md
│   ├── architecture/             # System architecture docs
│   ├── audits/                   # Code reviews and audits
│   ├── changelogs/               # Version changelogs
│   └── features/                 # Feature-specific docs
│       ├── incident/
│       └── whs-dashboard/
└── CLAUDE.md                     # Frontend-specific rules
```

---

## Feature Development Workflow

### Example: Creating a "Holiday" Feature

#### Step 1: Plan the Feature

```
Feature: Holiday Management
- Admin can manage company holidays
- Holidays affect check-in requirements
- Need list, create, edit, delete
```

#### Step 2: Generate Backend Module

```
/backend-crud-module

Feature: holiday
Model fields:
- name: string (required, max 100)
- date: Date (required)
- description: string (optional, max 500)
- isRecurring: boolean (default false)

Roles:
- ADMIN: full CRUD access
- Others: read-only
```

**Generated files:**
```
aegira-backend/src/modules/holiday/
├── holiday.routes.ts
├── holiday.controller.ts
├── holiday.repository.ts
└── holiday.validator.ts
```

#### Step 3: Add to App Routes

```typescript
// aegira-backend/src/app.ts
import { holidayRoutes } from './modules/holiday/holiday.routes';

app.route('/holidays', holidayRoutes);
```

#### Step 4: Add Frontend Endpoint

```typescript
// aegira-frontend/src/lib/api/endpoints.ts
export const ENDPOINTS = {
  // ... existing endpoints
  HOLIDAY: {
    LIST: '/holidays',
    CREATE: '/holidays',
    BY_ID: (id: string) => `/holidays/${id}`,
    UPDATE: (id: string) => `/holidays/${id}`,
    DELETE: (id: string) => `/holidays/${id}`,
  },
} as const;
```

#### Step 5: Add Frontend Types

```typescript
// aegira-frontend/src/types/holiday.types.ts
export interface Holiday {
  id: string;
  name: string;
  date: string;
  description?: string;
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateHolidayData {
  name: string;
  date: string;
  description?: string;
  isRecurring?: boolean;
}

export interface UpdateHolidayData extends Partial<CreateHolidayData> {}
```

#### Step 6: Generate Query Hooks

```
/query-hooks

Feature: holiday
Hooks needed:
- useHolidays (paginated list)
- useHoliday (single by ID)
```

**Generated file:**
```
aegira-frontend/src/features/admin/hooks/useHolidays.ts
```

#### Step 7: Generate Mutation Hooks

```
/mutation-hooks

Feature: holiday
Mutations:
- useCreateHoliday
- useUpdateHoliday
- useDeleteHoliday
```

**Added to:**
```
aegira-frontend/src/features/admin/hooks/useHolidays.ts
```

#### Step 8: Generate List Page

```
/data-table-page

Feature: holiday
Route: /admin/holidays
Columns: name, date, isRecurring, actions
Search: by name
```

**Generated file:**
```
aegira-frontend/src/features/admin/pages/AdminHolidaysPage.tsx
```

#### Step 9: Generate Form Pages

```
/form-component

Feature: holiday
Pages: create and edit
Fields: name, date, description, isRecurring
```

**Generated files:**
```
aegira-frontend/src/features/admin/pages/AdminHolidayCreatePage.tsx
aegira-frontend/src/features/admin/pages/AdminHolidayEditPage.tsx
```

#### Step 10: Add Routes

```typescript
// aegira-frontend/src/config/routes.config.ts
export const ROUTES = {
  // ... existing routes
  ADMIN_HOLIDAYS: '/admin/holidays',
  ADMIN_HOLIDAY_CREATE: '/admin/holidays/create',
  ADMIN_HOLIDAY_EDIT: '/admin/holidays/:holidayId/edit',
} as const;

// aegira-frontend/src/routes/index.tsx
// Add lazy imports and route definitions
```

---

## When to Use Each Skill

| I need to... | Use this skill |
|--------------|----------------|
| Create new backend API module | `/backend-crud-module` |
| Add complex business logic | `/backend-service` |
| Fetch data from API | `/query-hooks` |
| Create/Update/Delete data | `/mutation-hooks` |
| Show paginated list with table | `/data-table-page` |
| Create forms for input | `/form-component` |
| Build role-specific dashboard | `/dashboard-page` |
| Show charts and analytics | `/analytics-page` |
| **Review my code** | `/code-review` |

---

## Decision Tree: When to Add Service Layer

```
Does the operation need:
├── Multi-step database operations? → YES → /backend-service
├── Complex calculations? → YES → /backend-service
├── Prisma transactions? → YES → /backend-service
├── Cross-module logic? → YES → /backend-service
└── Just simple CRUD? → NO → Use repository directly
```

See `docs/ai-agent-guidelines/04-decision-trees.md` for more decision guides.

---

## Rules Auto-Applied

When using skills, these rules are automatically followed:

### Backend Rules
- Multi-tenant isolation via `BaseRepository.where()`
- Middleware chain: `authMiddleware` → `tenantMiddleware` → `roleMiddleware` → `zValidator`
- Response format: `{ success: true, data: ... }`
- Fire-and-forget audit logs
- Zod validation for all inputs

### Frontend Rules
- TanStack Query for server state
- `STALE_TIMES` constants for cache timing
- `PageLoader` wrapper for loading/error states
- Columns defined outside components
- `mutateAsync` + try/catch for form submissions
- Query invalidation on mutations

---

## Common Patterns Quick Reference

### Backend: Repository Method

```typescript
async findAll(params: PaginationParams): Promise<PaginatedResponse<T>> {
  const where = this.where({ is_active: true });
  const [items, total] = await Promise.all([
    this.prisma.model.findMany({ where, skip: calculateSkip(params), take: params.limit }),
    this.prisma.model.count({ where }),
  ]);
  return paginate(items, total, params);
}
```

### Frontend: Query Hook

```typescript
export function useHolidays(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['holidays', page, limit],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: () => apiClient.get<PaginatedResponse<Holiday>>(
      `${ENDPOINTS.HOLIDAY.LIST}?page=${page}&limit=${limit}`
    ),
  });
}
```

### Frontend: Mutation with Toast

```typescript
const onSubmit = async (data: FormData) => {
  try {
    await createHoliday.mutateAsync(data);
    toast({ title: 'Success', description: 'Holiday created' });
    navigate(ROUTES.ADMIN_HOLIDAYS);
  } catch (error) {
    toast({
      title: 'Error',
      description: error instanceof Error ? error.message : 'Failed',
      variant: 'destructive',
    });
  }
};
```

---

## Checklist for New Features

### Backend
- [ ] Create module in `src/modules/<feature>/`
- [ ] Add routes, controller, repository, validator
- [ ] Add service layer if needed (see decision tree)
- [ ] Register routes in `app.ts`
- [ ] Add audit logging for create/update/delete
- [ ] Test with Prisma Studio or API client

### Frontend
- [ ] Add types in `src/types/<feature>.types.ts`
- [ ] Add endpoints in `src/lib/api/endpoints.ts`
- [ ] Create hooks in `src/features/<feature>/hooks/`
- [ ] Create pages in `src/features/<feature>/pages/`
- [ ] Add routes in `src/config/routes.config.ts`
- [ ] Register routes in `src/routes/index.tsx`
- [ ] Add to Sidebar navigation if needed

---

## Code Review

Para i-review kung tama yung code mo, see **[HOW-TO-REVIEW-CODE.md](./HOW-TO-REVIEW-CODE.md)**.

Quick command:
```
/code-review src/modules/[feature]/
/code-review src/features/[feature]/
```

---

## Troubleshooting

### "Query not updating after mutation"
- Check if you're invalidating the correct queryKey
- Mutation `onSuccess` should invalidate related queries

### "Data undefined on first render"
- Use `data?.items ?? []` for safe access
- Wrap with `PageLoader` component

### "Form not submitting"
- Check Zod schema matches form fields
- Use `mutateAsync` not `mutate`
- Check for validation errors in form state

### "401 Unauthorized"
- Check if route has `authMiddleware`
- Verify JWT cookie is being sent
- Check role permissions with `roleMiddleware`

---

## Related Documentation

| Topic | Location |
|-------|----------|
| Architecture rules | `docs/ai-agent-guidelines/01-architecture-rules.md` |
| Backend patterns | `docs/ai-agent-guidelines/02-backend-patterns.md` |
| Frontend patterns | `docs/ai-agent-guidelines/03-frontend-patterns.md` |
| Decision trees | `docs/ai-agent-guidelines/04-decision-trees.md` |
| Security checklist | `docs/ai-agent-guidelines/05-security-checklist.md` |
| Testing patterns | `docs/ai-agent-guidelines/06-testing-patterns.md` |
| Error handling | `docs/ai-agent-guidelines/07-error-handling.md` |
| Code review | `docs/ai-agent-guidelines/08-code-review-checklist.md` |
