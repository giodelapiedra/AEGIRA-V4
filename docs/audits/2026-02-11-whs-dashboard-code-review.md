# WHS Dashboard & Analytics - Code Review

**Date:** 2026-02-11
**Reviewer:** Senior Software Engineer (Claude Code)
**Scope:** WHS Operational Dashboard, WHS Analytics Page, Backend Services, Frontend Components
**Files Reviewed:** 25+ files across backend and frontend
**Reference:** Full analysis written to `docs/architecture/SENIOR DEV.MD` (Section 9)

---

## Review Summary

Comprehensive code review of the WHS Dashboard and Analytics feature following the instructions in `docs/features/whs-dashboard/agent.md`. The review validated the system flow, identified bugs at the logic/code level, reviewed code quality, and flagged feature gaps.

---

## Findings

### Critical Bugs (Must Fix)

| # | Bug | Location | Status |
|---|-----|----------|--------|
| 1 | Prisma Client not regenerated — missed check-in detector completely broken | `missed-check-in-detector.ts` | FIXED (2026-02-11) |
| 2 | WHS Analytics access control uses `whsOnly` instead of `whsAccess` — ADMIN users blocked | `dashboard.routes.ts:43` | Open (needs product decision) |
| 3 | Activity feed action URLs broken for all incident events — `incidentId` missing from event payloads | `incident.service.ts` + `whs-dashboard.service.ts:buildActionUrl()` | Open |

### Code Quality Issues (Optional)

| # | Issue | Location |
|---|-------|----------|
| 1 | IncidentTrendChart renders stacked areas + total line = visual double-rendering | `IncidentTrendChart.tsx:91-123` |
| 2 | Pending incidents fetched with `take: 20` then sorted in-memory — could miss highest-severity if >20 pending | `whs-dashboard.service.ts:152-167` |

### Feature Gaps (Not Essential)

| # | Gap | Notes |
|---|-----|-------|
| 1 | No direct link from WHS Dashboard to WHS Analytics page | Sidebar provides navigation; UX improvement only |

---

## What Was Validated as Correct

1. Dashboard router correctly routes WHS role to `<WhsDashboard />`
2. Single-endpoint dashboard pattern (one hook, one loading state per page)
3. All components are presentational (no internal data fetching)
4. Cache invalidation on `['dashboard']` prefix in all 4 mutation hooks
5. Multi-tenant isolation via `company_id` filtering on all queries
6. Backend query parallelism (`Promise.all()` for 7 and 9 queries respectively)
7. Raw SQL for timezone-aware analytics aggregations
8. Zero-fill dates for continuous chart rendering
9. Type safety with imported enum types (not loose strings)
10. Chart color centralization in `chartConfig.ts`

---

## Logic-Level Verification (Deep Dive)

Cross-referenced event payload keys between services that CREATE events and services that CONSUME them:

### formatEventMessage() — All Keys Match
| Event Type | Payload Keys Used | Source Service | Status |
|---|---|---|---|
| INCIDENT_CREATED | `incidentType`, `severity` | `incident.service.ts:97-103` | MATCH |
| INCIDENT_APPROVED | `incidentNumber`, `caseNumber` | `incident.service.ts:220-224` | MATCH |
| INCIDENT_REJECTED | `incidentNumber`, `rejectionReason` | `incident.service.ts:344-348` | MATCH |
| CASE_UPDATED | `caseNumber`, `status` | `case.service.ts:139-146` | MATCH |
| CASE_RESOLVED | `caseNumber` | `case.service.ts:139-146` | MATCH |

### buildActionUrl() — Incident Events Broken
| Event Type | Expected Key | In Payload? | Status |
|---|---|---|---|
| INCIDENT_CREATED | `incidentId` | NO | BROKEN |
| INCIDENT_APPROVED | `incidentId` | NO (has `caseId` but wrong branch) | BROKEN |
| INCIDENT_REJECTED | `incidentId` | NO | BROKEN |
| CASE_CREATED | `caseId` | YES | WORKS |
| CASE_UPDATED | `caseId` | YES | WORKS |
| CASE_RESOLVED | `caseId` | YES | WORKS |

---

## Actions Taken

1. **FIXED BUG 1**: Regenerated Prisma Client + created and applied performance indexes migration. See `docs/changelogs/2026-02-11-prisma-sync-and-performance-indexes.md`
2. **DOCUMENTED**: Full analysis written to `docs/architecture/SENIOR DEV.MD` Section 9 (subsections 9.1-9.6)

---

## Remaining Open Items

- BUG 2: Decide if WHS Analytics should be WHS-only or WHS+ADMIN, then align backend route + frontend route guard + sidebar
- BUG 3: Add `incidentId` to incident event payloads in `incident.service.ts` to fix activity feed action URLs
