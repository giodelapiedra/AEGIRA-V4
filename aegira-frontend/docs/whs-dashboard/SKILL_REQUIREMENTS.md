# WHS Dashboard — Skill Requirements

## Document Information

| Field | Value |
|-------|-------|
| **Project** | AEGIRA V5 — Workforce Readiness & WHS Management |
| **Document** | Required skills, team composition, and tooling for WHS dashboard |
| **Version** | 3.0 |
| **Date** | 2026-02-04 |
| **Audience** | Hiring Managers, Tech Leads, Project Managers |

---

## Table of Contents

1. [Scope of Work](#1-scope-of-work)
2. [Required Skills](#2-required-skills)
3. [Domain Knowledge](#3-domain-knowledge)
4. [Team Composition](#4-team-composition)
5. [Tools & Environment](#5-tools--environment)
6. [Glossary](#6-glossary)

---

## 1. Scope of Work

The WHS dashboard is a **lightweight, incident-focused** feature. It consists of:

| Layer | Work |
|-------|------|
| Backend | 1 new service file, 1 new endpoint, 2 updated files |
| Frontend | 1 types file, 1 hook (added to existing file), 1 page, 3 section components |
| Updates | 5 existing files updated (endpoints, router, 3 mutation hooks) |
| Dependencies | No new npm packages |

This is not a charting-heavy analytics dashboard. It uses existing `StatCard`, `Table`, and `Badge` components — no Recharts or chart libraries needed.

---

## 2. Required Skills

### 2.1 Backend

| Skill | Level | Needed For |
|-------|-------|-----------|
| **TypeScript (strict)** | Intermediate | Service, controller, types — no `any` |
| **Hono** | Intermediate | Route handler, middleware, context (`c.get('personId')`) |
| **Prisma ORM** | Intermediate | `count`, `groupBy`, `findMany` with filters, raw SQL for severity sort |
| **PostgreSQL** | Basic-Intermediate | `GROUP BY`, `COUNT`, `CASE WHEN` for severity ordering, date filtering |
| **Luxon** | Basic | Timezone-aware "start of month" for resolved count |

### 2.2 Frontend

| Skill | Level | Needed For |
|-------|-------|-----------|
| **TypeScript (strict)** | Intermediate | Interfaces, prop types, no `any` |
| **React 18** | Intermediate | Functional components, hooks |
| **TanStack Query v5** | Intermediate | `useQuery` hook, `queryKey`, `staleTime`, cache invalidation |
| **Tailwind CSS** | Intermediate | Grid layout (`grid-cols-2 lg:grid-cols-4`), responsive design |
| **shadcn/ui** | Basic | `Card`, `Table`, `Badge`, `Button` usage |

### 2.3 Not Required for This Feature

| Skill | Why Not Needed |
|-------|---------------|
| Recharts / chart libraries | Dashboard uses stat cards and tables, not charts |
| React Hook Form / Zod (frontend) | No forms on the dashboard page |
| Zustand | No client-only state needed |
| CSS modules / styled-components | Tailwind CSS only |
| Advanced PostgreSQL (window functions, CTEs) | Simple counts and groupBy queries |

---

## 3. Domain Knowledge

| Knowledge Area | Why It Matters | Where to Learn |
|---------------|---------------|----------------|
| **Incident workflow** | Understanding PENDING → APPROVED/REJECTED flow | [Feature Audit — Section 2.2](WHS_FEATURE_AUDIT.md#22-incident-status-workflow) |
| **Case workflow** | Understanding OPEN → INVESTIGATING → RESOLVED → CLOSED | [Feature Audit — Section 3.2](WHS_FEATURE_AUDIT.md#32-case-status-workflow) |
| **WHS role scope** | WHS officers only monitor incidents — not check-ins or teams | [Feature Audit — Section 1](WHS_FEATURE_AUDIT.md#1-whs-officer-role-definition) |
| **Multi-tenant** | All queries filter by `company_id` via `BaseRepository` | `aegira-backend/src/shared/base.repository.ts` |
| **Existing dashboard pattern** | Other 4 dashboards follow single-endpoint + StatCard pattern | [Patterns — Section 1](DASHBOARD_PATTERNS.md#1-single-endpoint-dashboard-pattern) |
| **Event sourcing** | Activity feed reads from `Event` table | `aegira-backend/prisma/schema.prisma` |

---

## 4. Team Composition

### 4.1 This Feature Can Be Built by a Single Developer

Given the scope (1 endpoint, 6 new files, 5 updates), a **single full-stack developer** familiar with the AEGIRA codebase can complete this feature.

### 4.2 If Splitting Work

| Role | Tasks |
|------|-------|
| Backend developer | Phase 1 (service, route, controller) |
| Frontend developer | Phases 2-4 (types, hook, components, page, routing) |
| Same person or QA | Phase 5 (empty states, skeleton, tests) |

### 4.3 Advisory

A WHS domain expert (or product owner familiar with WHS workflows) should validate the dashboard content before implementation to confirm:
- Correct stat card labels
- Correct pending incident sort order (severity then date)
- Useful activity feed event format

---

## 5. Tools & Environment

### 5.1 Development

| Tool | Purpose |
|------|---------|
| Node.js >= 20 | Runtime |
| PostgreSQL >= 14 | Database |
| Prisma Studio | Inspect incident/case data during development |
| TanStack Query DevTools | Verify cache state and query key correctness |

### 5.2 Testing

| Tool | Purpose |
|------|---------|
| Vitest | Test runner |
| Testing Library | Component rendering tests |
| MSW | Mock `GET /dashboard/whs` responses for hook tests |

### 5.3 No New Dependencies

This feature requires **no new npm packages**. Everything needed is already in the project.

---

## 6. Glossary

| Term | Definition |
|------|-----------|
| **WHS** | Workplace Health and Safety |
| **Incident** | A report submitted by any worker about a workplace safety event |
| **Case** | An investigation record created when a WHS officer approves an incident |
| **PENDING** | Incident status — awaiting WHS review |
| **APPROVED** | Incident status — accepted, case created |
| **REJECTED** | Incident status — declined with reason |
| **OPEN** | Case status — newly created from approved incident |
| **INVESTIGATING** | Case status — actively being looked into |
| **RESOLVED** | Case status — investigation complete |
| **CLOSED** | Case status — final, no further action |

---

**Prev:** [Dashboard Patterns](DASHBOARD_PATTERNS.md)
