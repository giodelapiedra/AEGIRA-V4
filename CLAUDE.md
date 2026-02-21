# AEGIRA V5 - Claude Code Rules

## Project Overview
AEGIRA is a **multi-tenant workforce readiness and check-in management system**. It tracks daily worker check-ins (sleep, stress, physical condition), calculates readiness scores, and manages teams with role-based access.

## Monorepo Structure
```
D:\AEGIRA V5\
├── aegira-backend/    → Hono API + Prisma + PostgreSQL
├── aegira-frontend/   → React + Vite + TanStack Query
├── .ai/               → Pattern library (source of truth for AI tools)
│   ├── patterns/      → ~25 atomic coding pattern files
│   ├── skills/        → 9 skill templates with @pattern markers
│   ├── rules/         → 3 rule templates
│   └── sync.config.json
├── .claude/           → AUTO-GENERATED (Claude Code reads from here)
├── docs/              → Human documentation (guides, architecture, audits)
├── sync-patterns.js   → Pattern-aware build/watch/validate script
└── package.json       → Root scripts
```

See `aegira-backend/CLAUDE.md` and `aegira-frontend/CLAUDE.md` for module-specific rules.

## Pattern Library

All coding patterns live in `.ai/patterns/` as atomic markdown files. Skills and rules reference these patterns via `<!-- @pattern: category/name -->` markers. The `sync-patterns.js` script resolves markers and generates `.claude/` output (current `sync.config.json` target).

**DO NOT** edit `.claude/skills/` or `.claude/rules/` directly — edit `.ai/` and run `npm run ai:build`.

| Command | Purpose |
|---------|---------|
| `npm run ai:build` | Build all skills + rules from templates |
| `npm run ai:watch` | Watch `.ai/` and auto-rebuild on changes |
| `npm run ai:validate` | Check references, detect drift, find orphans |
| `npm run ai:diff` | Dry run showing what would change |

See `docs/guides/HOW-TO-SYNC-PATTERNS.md` for full documentation.

## Tech Stack

### Backend
- **Runtime**: Node.js >= 20, ESM
- **Framework**: Hono
- **ORM**: Prisma (PostgreSQL)
- **Validation**: Zod + @hono/zod-validator
- **Auth**: JWT (jsonwebtoken) + bcrypt (httpOnly cookies)
- **Logging**: Pino
- **Storage**: Cloudflare R2 (S3-compatible)
- **Scheduling**: node-cron
- **Timezone**: Luxon (Asia/Manila default)
- **Testing**: Vitest
- **Build**: tsup + tsx

### Frontend
- **Framework**: React 18 + TypeScript
- **Build**: Vite + SWC
- **Routing**: React Router v6
- **Server State**: TanStack Query v5
- **Client State**: Zustand (auth only)
- **Tables**: TanStack Table v8
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts (area, pie/donut charts for analytics)
- **UI**: Radix UI + Tailwind CSS + shadcn/ui (CVA, clsx, tailwind-merge)
- **Icons**: Lucide React
- **Testing**: Vitest + Testing Library + MSW

## Architecture

### Backend Modules
Each module follows: `routes.ts` → `controller.ts` → `service.ts` (optional) → `repository.ts` → `validator.ts`
All inside `src/modules/<feature>/`

Current modules: `auth`, `person`, `team`, `check-in`, `missed-check-in`, `notification`, `dashboard`, `admin`, `incident`, `case`

### Frontend Features
Each feature follows: `pages/` → `components/` (optional) → `hooks/`
All inside `src/features/<feature>/`

Current features: `auth`, `dashboard`, `check-in`, `team`, `person`, `notifications`, `schedule`, `admin`, `incident`

### Database Models
```
Company → Person → CheckIn / MissedCheckIn
Company → Person → Incident → Case
Company → Team → Person (members)
Event (event sourcing), Notification, Amendment, AuditLog, Holiday
```

### Key Patterns
- **Multi-tenant**: Every query filters by `company_id` via `BaseRepository`
- **Event sourcing**: State changes recorded as `Event` entities
- **Role-based access**: `ADMIN`, `WHS`, `SUPERVISOR`, `TEAM_LEAD`, `WORKER`
- **Pagination**: All list endpoints paginated with `{ items, pagination }` response format
- **Fire-and-forget**: Audit logs and notifications never block main operations

### Response Format (Backend → Frontend)
```
Success:   { success: true, data: T }
Paginated: { success: true, data: { items: T[], pagination: { page, limit, total, totalPages } } }
Error:     { success: false, error: { code: 'ERROR_CODE', message: 'User message' } }
```

The frontend `apiClient` unwraps `response.data` automatically — hooks receive `T` directly, not the `{ success, data }` wrapper.

## Commands

### Backend (`aegira-backend/`)
- `npm run dev` — Start dev server (tsx watch)
- `npm run db:migrate` — Run Prisma migrations
- `npm run db:generate` — Generate Prisma client
- `npm run db:studio` — Open Prisma Studio
- `npm run db:seed` — Seed database
- `npm test` — Run tests (Vitest watch)
- `npm run test:run` — Run tests once
- `npm run typecheck` — TypeScript check

### Frontend (`aegira-frontend/`)
- `npm run dev` — Start Vite dev server
- `npm run build` — TypeScript check + Vite build
- `npm test` — Run tests (Vitest watch)
- `npm run test:run` — Run tests once
- `npm run lint` — ESLint
- `npm run format` — Prettier

## Feature Creation Workflow

When the user asks to create a new feature or module, **ALWAYS invoke the matching skill** before writing any code. This ensures all generated code follows the established patterns.

### Skill Selection Matrix

| User Request | Skill to Invoke | What It Generates |
|---|---|---|
| "Create backend module/feature X" | `/backend-crud-module` | routes, controller, repository, validator |
| "Add business logic/service for X" | `/backend-service` | service layer with complex logic |
| "Create list/table page for X" | `/data-table-page` | paginated DataTable page + query hook |
| "Create form/create/edit page for X" | `/form-component` | React Hook Form + Zod form page |
| "Create dashboard page for X role" | `/dashboard-page` | StatCards + sub-components dashboard |
| "Create analytics/chart page for X" | `/analytics-page` | Recharts + period selector page |
| "Create query hook for X" | `/query-hooks` | TanStack Query useQuery hook |
| "Create mutation hook for X" | `/mutation-hooks` | TanStack Query useMutation hook |

### Full-Stack Feature Flow

When asked to create a **complete feature** (e.g., "add schedule feature"), follow this order:

1. **Database** — Add/update Prisma schema if needed, run `npm run db:migrate` in `aegira-backend/`
2. **Backend** — Invoke `/backend-crud-module` (+ `/backend-service` if complex logic needed)
3. **Frontend hooks** — Invoke `/query-hooks` and `/mutation-hooks`
4. **Frontend pages** — Invoke `/data-table-page` for list, `/form-component` for create/edit
5. **Routes** — Register backend routes in `app.ts`, frontend routes in `routes/index.tsx` + `routes.config.ts`
6. **Navigation** — Add to Sidebar if needed

### Rules
- ALWAYS invoke the skill BEFORE writing code — the skill contains the exact patterns to follow
- If a request spans multiple skills (e.g., "full CRUD feature"), invoke them sequentially in the order above
- After generating code, verify it follows the patterns by checking against the nearest existing module
- If the user specifies a pattern that conflicts with a skill's pattern, follow the user's instruction

## General Rules

### TypeScript
- NO `any` types — strict TypeScript everywhere
- Use `interface` for object shapes, `type` for unions/primitives
- Explicit return types on all backend functions
- Explicit `interface` for all frontend component props

### Consistency
- Always check existing code before creating new patterns
- Backend: check `shared/` for utilities, `middleware/` for middleware
- Frontend: check `components/ui/` and `components/common/` for existing components
- Follow the same pattern as the nearest similar module — consistency over preference

### Naming Conventions
- Backend files: `kebab-case` (e.g., `check-in.routes.ts`)
- Frontend files: `PascalCase` for components (e.g., `TeamsPage.tsx`), `camelCase` for hooks (e.g., `useTeams.ts`)
- Backend DB columns: `snake_case`
- Frontend/Backend variables: `camelCase`
- Types/Interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
