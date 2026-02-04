# AEGIRA V5 - Claude Code Rules

## Project Overview
AEGIRA is a **multi-tenant workforce readiness and check-in management system**. It tracks daily worker check-ins (sleep, stress, physical condition), calculates readiness scores, and manages teams with role-based access.

## Monorepo Structure
```
D:\AEGIRA V5\
├── aegira-backend/    → Hono API + Prisma + PostgreSQL
├── aegira-frontend/   → React + Vite + TanStack Query
├── package.json       → Root scripts (sync-context)
└── sync-context.js    → Context sync utility
```

See `aegira-backend/CLAUDE.md` and `aegira-frontend/CLAUDE.md` for module-specific rules.

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
- **UI**: Radix UI + Tailwind CSS + shadcn/ui (CVA, clsx, tailwind-merge)
- **Icons**: Lucide React
- **Testing**: Vitest + Testing Library + MSW

## Architecture

### Backend Modules
Each module follows: `routes.ts` → `controller.ts` → `service.ts` (optional) → `repository.ts` → `validator.ts`
All inside `src/modules/<feature>/`

Current modules: `auth`, `person`, `team`, `check-in`, `missed-check-in`, `notification`, `dashboard`, `admin`

### Frontend Features
Each feature follows: `pages/` → `components/` (optional) → `hooks/`
All inside `src/features/<feature>/`

Current features: `auth`, `dashboard`, `check-in`, `team`, `person`, `notifications`, `schedule`, `admin`

### Database Models
```
Company → Person → CheckIn / MissedCheckIn
Company → Team → Person (members)
Event (event sourcing), Notification, Amendment, AuditLog, Holiday
```

### Key Patterns
- **Multi-tenant**: Every query filters by `company_id` via `BaseRepository`
- **Event sourcing**: State changes recorded as `Event` entities
- **Role-based access**: `ADMIN`, `SUPERVISOR`, `TEAM_LEAD`, `WORKER`
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
