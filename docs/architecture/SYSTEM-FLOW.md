# AEGIRA V5 - System Flow Documentation

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         AEGIRA V5                                │
│              Multi-tenant Workforce Readiness System             │
└─────────────────────────────────────────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
         ┌──────▼──────┐              ┌──────▼──────┐
         │   Backend   │              │  Frontend   │
         │ Hono + Prisma│             │ React + Vite│
         └──────┬──────┘              └──────┬──────┘
                │                             │
                │         HTTP/JSON           │
                └─────────────┬───────────────┘
                              │
                    ┌─────────▼─────────┐
                    │    PostgreSQL     │
                    │  (Multi-tenant)   │
                    └───────────────────┘
```

---

## 1. Request Flow

### User → Frontend → Backend → Database

```
1. User Action (Browser)
   └─> React Component
       └─> TanStack Query Hook (useQuery/useMutation)
           └─> apiClient.get/post/patch/delete
               └─> HTTP Request (credentials: include - httpOnly cookies)
                   │
                   ▼
2. Backend (Hono)
   └─> Route Handler
       └─> Middleware Chain:
           ├─> authMiddleware      (JWT verify, set user context)
           ├─> tenantMiddleware    (Set company_id, timezone)
           ├─> roleMiddleware      (Check permissions)
           └─> zValidator          (Zod schema validation)
       └─> Controller
           └─> Service (optional - if business logic)
               └─> Repository (BaseRepository)
                   └─> Prisma Client
                       └─> PostgreSQL Query (with company_id filter)
                           │
                           ▼
3. Database
   └─> Execute Query (Multi-tenant isolated)
   └─> Return Results
       │
       ▼
4. Response Path
   └─> Repository → Service → Controller
       └─> Fire-and-Forget (No await):
           ├─> logAudit()        (Audit log)
           └─> sendNotification() (Push notification)
       └─> Return JSON:
           {
             success: true,
             data: { items: [...], pagination: {...} }
           }
       │
       ▼
5. Frontend Receives
   └─> apiClient unwraps response.data
       └─> TanStack Query caches result
           └─> Component re-renders with data
```

---

## 2. Module Structure Flow

### Backend Module (5-Layer Pattern)

```
src/modules/feature/
│
├─ feature.routes.ts       ┐
│  └─> Define routes       │
│  └─> Apply middleware    │ Layer 1: HTTP Routes
│  └─> Mount controllers   │
│                          ┘
├─ feature.controller.ts   ┐
│  └─> Extract context     │
│  └─> Call service/repo   │ Layer 2: Request Handling
│  └─> Format response     │
│  └─> Fire-and-forget     │
│                          ┘
├─ feature.service.ts      ┐
│  (Optional)              │
│  └─> Business logic      │ Layer 3: Business Logic
│  └─> Transactions        │ (Optional)
│  └─> Calculations        │
│                          ┘
├─ feature.repository.ts   ┐
│  └─> Extends BaseRepo    │
│  └─> Prisma queries      │ Layer 4: Data Access
│  └─> Multi-tenant filter │
│                          ┘
└─ feature.validator.ts    ┐
   └─> Zod schemas         │ Layer 5: Validation
   └─> Type exports        │
                           ┘
```

### Frontend Feature (3-Layer Pattern)

```
src/features/feature/
│
├─ pages/                  ┐
│  ├─ FeatureListPage.tsx  │
│  ├─ FeatureDetailPage.tsx│ Layer 1: Pages (Routes)
│  ├─ FeatureCreatePage.tsx│
│  └─ FeatureEditPage.tsx  │
│                          ┘
├─ components/             ┐
│  └─ (optional)           │ Layer 2: Components
│     └─ Sub-components    │ (Optional)
│                          ┘
└─ hooks/                  ┐
   └─ useFeatures.ts       │
      ├─ useFeatures()     │ Layer 3: Data Hooks
      ├─ useFeature()      │ (TanStack Query)
      ├─ useCreateFeature()│
      ├─ useUpdateFeature()│
      └─ useDeleteFeature()│
                           ┘
```

---

## 3. Authentication Flow

```
┌──────────────┐
│ Login Page   │
└──────┬───────┘
       │ POST /auth/login { email, password }
       ▼
┌────────────────────────────────┐
│ Backend Auth Controller        │
│ 1. Validate credentials        │
│ 2. Compare bcrypt hash         │
│ 3. Generate JWT token          │
│ 4. Set httpOnly cookie         │
└────────────┬───────────────────┘
             │ Set-Cookie: token=xxx; HttpOnly; Secure
             ▼
┌────────────────────────────────┐
│ Browser stores cookie          │
│ (Not accessible to JS)         │
└────────────┬───────────────────┘
             │ Subsequent requests include cookie automatically
             ▼
┌────────────────────────────────┐
│ Backend authMiddleware         │
│ 1. Extract cookie              │
│ 2. Verify JWT                  │
│ 3. Set user context:           │
│    - c.set('userId')           │
│    - c.set('companyId')        │
│    - c.set('userRole')         │
└────────────┬───────────────────┘
             │
             ▼
┌────────────────────────────────┐
│ Protected Route Handler        │
│ Access via: c.get('userId')    │
└────────────────────────────────┘
```

---

## 4. Multi-Tenant Isolation Flow

```
Every Database Query:

┌─────────────────────────────┐
│ Controller                  │
│ const companyId = c.get()   │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Repository Constructor      │
│ new Repo(prisma, companyId) │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ BaseRepository.where()      │
│ Injects: { company_id }     │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Prisma Query                │
│ WHERE company_id = $1       │
│ AND ...other conditions     │
└─────────────────────────────┘

CRITICAL: NEVER query without company_id filter
```

---

## 5. State Management Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend State Layers                    │
└─────────────────────────────────────────────────────────────┘

Layer 1: Server State (TanStack Query)
┌──────────────────────────────────┐
│ useQuery / useMutation           │
│ - API responses                  │
│ - Caching (stale time)           │
│ - Background refetch             │
│ - Automatic retries              │
└──────────────────────────────────┘

Layer 2: Auth State (Zustand)
┌──────────────────────────────────┐
│ auth.store.ts                    │
│ - Current user                   │
│ - User role                      │
│ - setAuth() / clearAuth()        │
└──────────────────────────────────┘

Layer 3: Form State (React Hook Form)
┌──────────────────────────────────┐
│ useForm()                        │
│ - Form field values              │
│ - Validation errors              │
│ - Submission state               │
└──────────────────────────────────┘

Layer 4: URL State (React Router)
┌──────────────────────────────────┐
│ useParams / useSearchParams      │
│ - Route params (:id)             │
│ - Query strings (?page=1)        │
└──────────────────────────────────┘
```

---

## 6. Data Flow: Create Operation

```
Example: Create New Team

1. User fills form
   └─> TeamCreatePage.tsx
       └─> useForm() validates
           └─> onSubmit triggered

2. Mutation called
   └─> useCreateTeam().mutateAsync(data)
       └─> apiClient.post('/teams', data)
           │
           ▼
3. Backend receives
   └─> POST /teams
       └─> authMiddleware (verify user)
       └─> tenantMiddleware (set company_id)
       └─> roleMiddleware(['ADMIN']) (check permission)
       └─> zValidator(createTeamSchema) (validate input)
       └─> controller.create()
           └─> repository.create(data)
               └─> prisma.team.create({
                     data: { ...data, company_id }
                   })
               └─> logAudit() (fire-and-forget)
           └─> return { success: true, data: team }
           │
           ▼
4. Frontend receives
   └─> mutation.onSuccess
       └─> queryClient.invalidateQueries(['teams'])
       └─> toast({ title: 'Success' })
       └─> navigate(ROUTES.ADMIN_TEAMS)
       └─> Teams list refetches automatically
```

---

## 7. Pagination Flow

```
Frontend (0-indexed) ←→ Backend (1-indexed)

┌─────────────────────────────────┐
│ Frontend Component              │
│ const [pagination, setPagination] = useState({
│   pageIndex: 0,    ← 0-indexed  │
│   pageSize: 20                  │
│ })                              │
└─────────────┬───────────────────┘
              │ Convert: pageIndex + 1
              ▼
┌─────────────────────────────────┐
│ useTeams(                       │
│   pagination.pageIndex + 1,  ←─ 1-indexed for API
│   pagination.pageSize           │
│ )                               │
└─────────────┬───────────────────┘
              │ GET /teams?page=1&limit=20
              ▼
┌─────────────────────────────────┐
│ Backend Controller              │
│ parsePagination(page, limit)    │
│ - Clamps: page 1-10000          │
│ - Clamps: limit 1-100           │
│ - Defaults: page=1, limit=20    │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│ Repository                      │
│ const [items, total] = await    │
│   Promise.all([                 │
│     prisma.team.findMany({...}),│
│     prisma.team.count({...})    │
│   ])                            │
│ return paginate(items, total,   │
│   page, limit)                  │
└─────────────┬───────────────────┘
              │ Response:
              │ {
              │   items: Team[],
              │   pagination: {
              │     page: 1,
              │     limit: 20,
              │     total: 50,
              │     totalPages: 3
              │   }
              │ }
              ▼
┌─────────────────────────────────┐
│ Frontend Receives               │
│ data.items → DataTable          │
│ data.pagination.totalPages      │
│   → pageCount                   │
└─────────────────────────────────┘
```

---

## 8. Cache Invalidation Flow

```
When Data Changes:

Mutation
└─> onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities'] })
      queryClient.invalidateQueries({ queryKey: ['entity', id] })
      queryClient.invalidateQueries({ queryKey: ['related'] })
    }

Invalidation Matrix:

CREATE Team
└─> Invalidate: ['teams']

UPDATE Team
└─> Invalidate: ['teams']
└─> Invalidate: ['team', teamId]

DELETE Team
└─> Invalidate: ['teams']
└─> Invalidate: ['persons']      (if team has members)
└─> Invalidate: ['dashboard']    (if affects dashboard)

SUBMIT CheckIn
└─> Invalidate: ['check-ins']
└─> Invalidate: ['dashboard']
└─> Invalidate: ['team', 'check-in-history']
```

---

## 9. Error Handling Flow

```
Backend Error:
┌────────────────────────┐
│ Repository/Service     │
│ throw new AppError(    │
│   'TEAM_NOT_FOUND',    │
│   'Team not found',    │
│   404                  │
│ )                      │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ Global Error Handler   │
│ Catches AppError       │
│ Returns:               │
│ {                      │
│   success: false,      │
│   error: {             │
│     code: 'TEAM_NOT_FOUND',
│     message: 'Team not found'
│   }                    │
│ }                      │
└───────────┬────────────┘
            │ Status: 404
            ▼
┌────────────────────────┐
│ Frontend apiClient     │
│ if (!response.ok)      │
│   throw new Error()    │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ Component try/catch    │
│ toast({                │
│   variant: 'destructive',
│   title: 'Error',      │
│   description: message │
│ })                     │
└────────────────────────┘
```

---

## 10. Pattern System Flow

```
Developer Workflow:

1. Edit Pattern
   └─> .ai/patterns/frontend/query-hooks.md
       │
       ▼
2. Run Build
   └─> npm run ai:build
       └─> sync-patterns.js
           ├─> Reads .ai/skills/*/SKILL.md
           ├─> Resolves <!-- @pattern: ... --> markers
           ├─> Injects pattern content
           └─> Writes .claude/skills/*/SKILL.md
       │
       ▼
3. Use Skill
   └─> /query-hooks products
       └─> Claude Code reads .claude/skills/query-hooks/SKILL.md
           └─> Generates code following patterns
               └─> Code matches .ai/patterns/ exactly
```

---

## 11. Complete Feature Flow

```
Example: Adding "Products" Feature

1. Plan
   └─> Check patterns: .ai/patterns/
   └─> Decide: CRUD module + list page + forms

2. Backend
   └─> /backend-crud-module products
   └─> Edit prisma/schema.prisma
   └─> npm run db:migrate
   └─> Register routes in app.ts

3. Frontend
   └─> /query-hooks products
   └─> /mutation-hooks products
   └─> /data-table-page products
   └─> /form-component products create
   └─> /form-component products edit
   └─> Add ENDPOINTS constants
   └─> Add routes to routes/index.tsx
   └─> Add ROUTES constants

4. Test
   └─> Backend: npm test
   └─> Frontend: npm test
   └─> Manual: Check in browser

5. Commit
   └─> /commit
   └─> Push to remote
```

---

## Key Principles

1. **Multi-tenant Isolation**: Every query filtered by `company_id`
2. **Single Source of Truth**: `.ai/patterns/` for all coding patterns
3. **Auto-generated Output**: `.claude/` never edited manually
4. **Fire-and-Forget**: Audit/notifications never block operations
5. **Type Safety**: No `any` types, strict TypeScript everywhere
6. **Consistent Structure**: Backend 5-layer, Frontend 3-layer
7. **State Separation**: Server (TanStack), Auth (Zustand), Form (RHF), URL (Router)
8. **Pattern-Driven**: Skills use patterns from `.ai/patterns/`

---

## Diagrams Location

- Request Flow: See Section 1
- Module Structure: See Section 2
- Auth Flow: See Section 3
- Multi-tenant: See Section 4
- State Management: See Section 5
- Data Flow: See Section 6
- Pagination: See Section 7
- Cache Invalidation: See Section 8
- Error Handling: See Section 9
- Pattern System: See Section 10
- Complete Feature: See Section 11
