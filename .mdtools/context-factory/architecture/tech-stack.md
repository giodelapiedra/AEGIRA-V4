---
description: AEGIRA V5 Full Tech Stack Reference
globs: ["**/*"]
alwaysApply: false
---
# Tech Stack

## Backend (aegira-backend/)

| Concern            | Technology                  | Version   |
| ------------------ | --------------------------- | --------- |
| Runtime            | Node.js                     | 20+       |
| Language           | TypeScript (strict mode)    | 5         |
| Framework          | Hono                        | latest    |
| ORM                | Prisma                      | 5.8.1     |
| Database           | PostgreSQL                  | 15+       |
| Validation         | Zod                         | 3.22      |
| Auth               | jsonwebtoken (JWT)          | 9.x       |
| Hashing            | bcrypt                      | 6.x       |
| Date/Time          | Luxon                       | 3.4       |
| Logging            | Pino                        | 8.x       |
| Cron               | node-cron                   | 4.x       |
| Build              | tsup                        | -         |
| Test               | vitest                      | -         |

## Frontend (aegira-frontend/)

| Concern            | Technology                  | Version   |
| ------------------ | --------------------------- | --------- |
| Language           | TypeScript (strict mode)    | 5         |
| UI Framework       | React                       | 18        |
| Build              | Vite                        | latest    |
| Server State       | TanStack Query              | v5        |
| Client State       | Zustand                     | latest    |
| Routing            | React Router                | v6        |
| Forms              | React Hook Form             | 7.49      |
| Validation         | Zod                         | 3.22      |
| Component Library  | shadcn/ui (Radix + Tailwind)| -         |
| Styling            | Tailwind CSS                | 3         |
| Icons              | lucide-react                | -         |
| Tables             | TanStack Table              | v8        |
| Date/Time          | Luxon                       | 3.4       |
| Test               | vitest + Testing Library    | -         |
| Mock               | MSW                         | 2.12      |

## Architecture Patterns

```
Backend:  Hono Routes → Controller → Service → Repository → Prisma → PostgreSQL
Frontend: Page → Hook (TanStack Query) → API Client → Backend API
```

## Key Architectural Decisions

- **Monorepo** with separate `aegira-backend/` and `aegira-frontend/` directories
- **Feature-based modules** (not layer-based) in both frontend and backend
- **Event-sourced** backend with immutable event records
- **Multi-tenant** with strict company_id isolation on every query
- **Server state in TanStack Query**, client state in Zustand (auth/UI only)
- **Zod** as the shared validation layer across both frontend and backend
- **Luxon** as the shared date/time library (UTC storage, timezone conversion for display)
