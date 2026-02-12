# AEGIRA V5 - Consolidated Code Audit Report

**Date:** 2026-02-11
**Method:** 7 parallel Claude Opus 4.6 agents
**Scope:** Full-stack audit (security, business logic, data access, API contracts, patterns, scheduler, tests)

---

## Executive Summary

Seven specialized agents audited the entire AEGIRA V5 codebase simultaneously, producing **129 total findings** across all domains. After deduplication of overlapping findings (8 duplicates removed), there are **~121 unique findings**.

| Severity | Count | % |
|----------|-------|---|
| CRITICAL | 20 | 15% |
| HIGH | 34 | 26% |
| MEDIUM | 45 | 35% |
| LOW | 30 | 23% |
| **Total** | **~129 raw / ~121 unique** | |

### Headline Numbers
- **20 CRITICAL findings** across security, business logic, contracts, scheduler, and test coverage
- **5 missing backend endpoints** that would 404 at runtime
- **Zero backend unit tests** for any module
- **No CI pipeline** exists
- **3 security vulnerabilities** requiring immediate attention (JWT algorithm confusion, no rate limiting, stale role claims)
- **1 formula bug** that produces incorrect readiness scores

---

## CRITICAL Findings (Top 20 - Immediate Action Required)

### Security (3)

| # | Title | Description | Effort |
|---|-------|-------------|--------|
| S1 | **No JWT revocation / 7-day token lifetime** | Single JWT with 7-day expiry, no refresh token, no way to revoke sessions after password change or account deactivation | L |
| S2 | **No brute-force protection on login** | Zero rate limiting on `/auth/login`. Combined with weak 8-char password policy, brute-force is trivial | M |
| S3 | **JWT role not re-validated against DB** | `authMiddleware` trusts JWT role claim without DB check. Demoted/deactivated users keep access for up to 7 days | M |

### Business Logic (3)

| # | Title | Description | Effort |
|---|-------|-------------|--------|
| B1 | **Stress score formula produces 10-100, not 0-100** | `(10 - stressLevel + 1) * 10` means max stress = 10 (not 0). Inflates readiness scores systemically | S |
| B2 | **Incident number race condition** | `findFirst` + increment in READ COMMITTED transaction. Concurrent incidents can get same number, 3 retries may not be enough | M |
| B3 | **Check-in service bypasses repository** | Uses global `prisma` import instead of injected repository, bypassing tenant isolation pattern | M |

### API Contracts (5)

| # | Title | Description | Effort |
|---|-------|-------------|--------|
| C1 | **`DELETE /teams/:id` - no backend route** | Frontend `useDeleteTeam` hook calls non-existent endpoint | M |
| C2 | **`POST /teams/:id/members` - no backend route** | Frontend `useAddTeamMember` hook calls non-existent endpoint | M |
| C3 | **`DELETE /teams/:id/members/:personId` - no backend route** | Frontend `useRemoveTeamMember` hook calls non-existent endpoint | M |
| C4 | **`GET /persons/:id/stats` - no backend route** | Frontend `usePersonStats` hook calls non-existent endpoint, used in PersonDetailPage | M |
| C5 | **`GET /persons/:id/check-ins` - no backend route** | Endpoint constant defined but route doesn't exist | S |

### Scheduler (3)

| # | Title | Description | Effort |
|---|-------|-------------|--------|
| J1 | **Daily reminder job is a stub (no-op)** | Scheduled at 5:30 AM, logs "completed" but does nothing. Workers receive no reminders | M |
| J2 | **Weekly cleanup job is a stub (no-op)** | Scheduled weekly, logs "completed" but does nothing. Notification table grows unbounded | M |
| J3 | **In-memory cron lock won't work multi-instance** | `isRunning` flag is per-process. Multiple instances = duplicate job execution | M |

### Pattern Compliance (2)

| # | Title | Description | Effort |
|---|-------|-------------|--------|
| P1 | **`missed-check-in` module missing routes.ts** | Routes embedded in `team.routes.ts`, violating module ownership | S |
| P2 | **Deleted `missed-check-in.service.ts` still in git** | Service deleted but snapshot service naming breaks convention | S |

### Test Coverage (4)

| # | Title | Description | Effort |
|---|-------|-------------|--------|
| T1 | **Zero backend unit/integration tests** | 11 services, 4 middleware, 8+ repositories with zero automated verification | XL |
| T2 | **Readiness score calculation untested** | Core safety-critical formula has zero test coverage | M |
| T3 | **Multi-tenant isolation untested** | No tests verify company_id filtering prevents cross-tenant data access | L |
| T4 | **No CI pipeline** | No `.github/workflows/`, no automated test execution on push/PR | M |

---

## Quick Wins (HIGH severity + S/M effort)

These deliver maximum impact for minimum investment. Recommended as first sprint:

| # | Source | Title | Effort | Impact |
|---|--------|-------|--------|--------|
| 1 | Security | Add JWT algorithm restriction (`algorithms: ['HS256']`) | S | Prevents algorithm confusion attacks |
| 2 | Security | Add security headers (Hono `secureHeaders()`) | S | Prevents clickjacking, MIME sniffing |
| 3 | Security | Strengthen password policy (12+ chars, complexity) | S | Reduces brute-force feasibility |
| 4 | Business | Fix stress score formula | S | Corrects all readiness scores |
| 5 | Business | Unify holiday date parsing (UTC vs Luxon inconsistency) | S | Prevents timezone bugs |
| 6 | Business | Document/fix teamless worker check-in behavior | S | Clarifies eligibility rules |
| 7 | Data | Configure connection pool + query timeouts | S | Prevents pool exhaustion under load |
| 8 | Data | Fix `TeamService.getTeamAnalytics` tenant leak (findUnique without company_id) | S | Closes cross-tenant data exposure |
| 9 | Contract | Add WHS to `TeamMember.role` enum | S | Fixes type mismatch |
| 10 | Contract | Add WHS to `updateUserRoleSchema` backend validator | S | Allows WHS role assignment |
| 11 | Scheduler | Add timezone option to cron schedules | S | Jobs fire at correct local time |
| 12 | Scheduler | Add `ENABLE_SCHEDULER` env toggle | S | Prevents dev/staging side effects |
| 13 | Scheduler | Fix misleading stub job log messages | S | Accurate monitoring |
| 14 | Pattern | Consolidate 3x `ReadinessBadge` implementations | M | Single source of truth |
| 15 | Pattern | Extract shared `validationHook` from auth routes | S | Consistent error format |
| 16 | Test | Set up CI pipeline | M | Foundation for all testing |
| 17 | Test | Write readiness score unit tests | M | Verify core business logic |

---

## Detailed Findings by Agent

### Agent 1: Security Auditor (20 findings)

#### CRITICAL (3)
1. **No JWT revocation** — Single 7-day access token, no refresh mechanism (returns 501), sessions survive password change. `auth.controller.ts:14`
2. **No brute-force protection** — Zero rate limiting on login, only 8-char password minimum. `auth.routes.ts:44`
3. **Stale JWT role claims** — `authMiddleware` trusts JWT role without DB re-validation. Demoted users keep old permissions for 7 days. `auth.ts:24`

#### HIGH (6)
4. No rate limiting on any endpoint (`app.ts:63`)
5. No security headers — missing X-Frame-Options, CSP, HSTS, etc. (`app.ts`)
6. JWT algorithm not restricted — vulnerable to algorithm confusion (`auth.service.ts:15`)
7. Weak password policy — only 8 chars, no complexity (`auth.validator.ts:14`)
8. Login picks newest account when email exists across companies — potential hijack (`auth.controller.ts:65`)
9. Sessions not invalidated on password change (`auth.controller.ts:172`)

#### MEDIUM (7)
10. Check-in routes missing role middleware (`check-in.routes.ts:12`)
11. Signup email uniqueness not scoped to company (`auth.controller.ts:261`)
12. CORS origins not validated (`app.ts:64`)
13. Dashboard team endpoint lacks membership verification (`dashboard.routes.ts:37`)
14. Admin endpoints lack query parameter validation (`admin.controller.ts:107`)
15. Cookie SameSite=Strict may break cross-origin deployments (`auth.controller.ts:20`)
16. Login audit logging excludes WORKER and WHS roles (`auth.controller.ts:109`)

#### LOW (4)
17. Health endpoint exposes server timestamp
18. Auth store pattern is actually correct (informational)
19. UUID params not validated in route handlers
20. Default CORS includes localhost

---

### Agent 2: Business Logic Auditor (20 findings)

#### CRITICAL (3)
1. **Stress score formula produces 10-100** — `(10 - stressLevel + 1) * 10` never reaches 0. (`check-in.service.ts:321`)
2. **Incident number race condition** — READ COMMITTED doesn't prevent same-number allocation (`incident.service.ts:47`)
3. **Check-in bypasses repository** — Uses global `prisma` import instead of injected repo (`check-in.service.ts:116`)

#### HIGH (4)
4. Readiness score weighting changes based on optional pain field — comparability issue (`check-in.service.ts:330`)
5. Holiday date comparison uses UTC vs Luxon inconsistently (`holiday.utils.ts:25`)
6. Workers without team can check in with no schedule validation (`check-in.service.ts:71`)
7. Supervisor dashboard compliance ignores holidays/schedules (`dashboard.service.ts:539`)

#### MEDIUM (7)
8. Streak calculation uses naive 24h subtraction (DST unsafe) (`missed-check-in-snapshot.service.ts:224`)
9. Dashboard worker streak adds today without checking if it's a work day (`dashboard.service.ts:169`)
10. Missed check-in detector only processes WORKER role (`missed-check-in-detector.ts:146`)
11. Check-in service has multiple sources of company_id (`check-in.service.ts:44`)
12. In-memory cron lock unsafe for multi-instance *(duplicate with J3)*
13. Dashboard completion rate "this week" scope not clearly named (`dashboard.service.ts:200`)
14. Detector doesn't re-verify team is_active between queries (`missed-check-in-detector.ts:142`)

#### LOW (6)
15. Sleep score >9h hardcoded to 90 (product decision)
16. Physical score range 10-100 vs pain score 0-100 inconsistency
17. Incident status transitions are terminal (no reopen)
18. Case status transitions not validated
19. Holiday check makes 2 DB queries on hot path
20. `formatCaseRef` uses `new Date()` instead of creation date

---

### Agent 3: Data Access Auditor (18 findings)

#### HIGH (4)
1. TeamService.getTeamAnalytics fetches ALL check-ins unbounded (`team.service.ts:93`)
2. No connection pool or query timeout configuration (`database.ts:11`)
3. Incident number race condition *(duplicate with B2)*
4. IncidentService doesn't extend BaseRepository; manual tenant filtering (`incident.service.ts:35`)

#### MEDIUM (9)
5. CheckInService.getCheckInStatus makes 3 sequential DB queries (`check-in.service.ts:215`)
6. CheckInService.submit makes sequential queries before transaction (`check-in.service.ts:48`)
7. MissedCheckIn missing index on `company_id, person_id` (`schema.prisma:211`)
8. Offset-based pagination degrades on deep pages (all repositories)
9. DashboardService uses dynamic import for Luxon on every call (`dashboard.service.ts:201`)
10. AdminRepository.updatePersonRole is not atomic (`admin.repository.ts:232`)
11. AdminRepository.listPersons returns wrong type (cast to Person with missing fields)
12. Missed check-in detector processes companies sequentially (`missed-check-in-detector.ts:79`)
13. TeamService.getTeamAnalytics findUnique without company_id filter (`team.service.ts:67`)

#### LOW (5)
14. Supervisor dashboard doesn't account for holidays
15. Notification.deleteOld could be slow without covering index
16. Case-insensitive search cannot use B-tree indexes
17. AdminRepository.listAuditLogs includes unnecessary person fields
18. CheckIn index monitoring for large IN clauses

---

### Agent 4: Contract Auditor (23 findings)

#### CRITICAL (5)
1. `DELETE /teams/:id` — no backend route (`useTeams.ts:127`)
2. `POST /teams/:id/members` — no backend route (`useTeams.ts:143`)
3. `DELETE /teams/:id/members/:personId` — no backend route (`useTeams.ts:160`)
4. `GET /persons/:id/stats` — no backend route (`usePersons.ts:96`)
5. `GET /persons/:id/check-ins` — no backend route (`endpoints.ts:58`)

#### HIGH (5)
6. `GET /teams/:id/schedule` endpoint defined, no backend route (`endpoints.ts:46`)
7. Notification type uses snake_case inconsistently with other types (`common.types.ts:59`)
8. TeamMember.role enum missing WHS (`team.types.ts:38`)
9. updateUserRoleSchema excludes WHS role (`admin.validator.ts:38`)
10. Pagination params unvalidated on missed-check-in queries (`missed-check-in.validator.ts:4`)

#### MEDIUM (7)
11. Person type snake_case vs Incident camelCase inconsistency
12. Incident query validators missing page/limit validation
13. Backend `GET /dashboard/summary` and `GET /dashboard/trends` — no frontend consumer
14. Backend `GET /dashboard/team/:id` — no frontend consumer
15. Backend `GET /admin/users/roles` and `PATCH /admin/users/:id/role` — no frontend endpoint
16. Backend `POST /auth/refresh` — stub with no frontend consumer
17. CheckInHistory flattens pagination instead of nesting

#### LOW (6)
18. PaginationParams.pageSize vs backend `limit` naming
19. Dead RegisterData type in auth.types.ts
20. Signup returns non-standard `message` field
21. ENDPOINTS.CHECK_IN.BY_PERSON defined but unused
22. CreatePersonData schedule fields silently dropped by controller
23. ENDPOINTS.CHECK_IN.BY_ID defined but unused

---

### Agent 5: Pattern Compliance Auditor (17 findings)

#### CRITICAL (2)
1. `missed-check-in` module routes embedded in `team.routes.ts` — missing own routes file
2. Deleted `missed-check-in.service.ts` — snapshot service naming breaks convention

#### HIGH (5)
3. 3 dead check-in form components (CheckInForm, CheckInFormImproved, SliderField)
4. ReadinessBadge implemented 3 separate times
5. Admin feature has no hooks/ directory — imports everything from other features
6. Schedule feature is minimal — single page, no hooks
7. Dashboard module has 3 service files, no repository or validator

#### MEDIUM (6)
8. 5 orphan pattern files not referenced by any skill
9. Empty components/ directories in auth and person features
10. validationHook only defined in auth.routes.ts, not shared
11. StatCard lives in dashboard but imported cross-feature
12. Inconsistent service file naming (snapshot, whs-analytics, whs-dashboard)
13. Auth module has no repository.ts

#### LOW (4)
14. AdminSystemHealthPage deleted — verify no orphan route constants
15. Cross-feature imports widespread but consistent
16. WhsWorkersPage under dashboard instead of dedicated whs feature
17. Inline getReadinessBadge duplicated in 2 pages

---

### Agent 6: Scheduler Auditor (15 findings)

#### CRITICAL (3)
1. Daily reminder job is a complete stub (no-op) — logs "completed" misleadingly
2. Weekly cleanup job is a complete stub (no-op) — notification table grows unbounded
3. In-memory cron lock won't work multi-instance *(overlaps with B12, D12)*

#### HIGH (5)
4. Cron expressions use server time, not Asia/Manila timezone
5. No graceful shutdown — jobs killed mid-execution
6. No retry logic for failed job runs
7. No job execution metrics or health tracking
8. No environment-based scheduler toggle — jobs run in all environments

#### MEDIUM (4)
9. Cron task references discarded — cannot stop or inspect
10. Stub jobs have no overlap guard
11. Misleading success logs from stub jobs
12. Daily reminder fires once globally but system is multi-tenant

#### LOW (3)
13. 90-day holiday lookback uses naive date calculation
14. Sequential company processing limits throughput
15. `addMinutesToTime` doesn't handle negative values

---

### Agent 7: Test Auditor (16 findings)

#### CRITICAL (4)
1. Zero backend unit/integration tests (only 1 E2E file with skipped test)
2. Readiness score calculation completely untested
3. Multi-tenant isolation completely untested
4. No CI pipeline exists

#### HIGH (5)
5. Auth flow tested only for rendering, not behavior
6. Incident and Case management completely untested (6 pages, 0 tests)
7. RBAC enforcement known broken — E2E test uses permissive assertions
8. MSW handlers cover only 12 of ~40+ endpoints, no error scenarios
9. Missed check-in detection job untested

#### MEDIUM (5)
10. Frontend tests are shallow — mostly "renders correctly"
11. Dashboard test has false-positive risk (direct store manipulation)
12. RouteGuard has zero tests despite being security boundary
13. API client error handling (401 redirect, timeout) not fully tested
14. Backend E2E has skipped test and 20+ console.log statements

#### LOW (2)
15. MSW `onUnhandledRequest: 'error'` creates barrier to new tests
16. No coverage threshold enforcement in vitest config

---

## Deduplicated Cross-Agent Overlaps

The following findings were flagged by multiple agents:

| Finding | Agents | Kept Under |
|---------|--------|------------|
| Incident number race condition | Business Logic, Data Access | B2 |
| In-memory cron lock | Business Logic, Data Access, Scheduler | J3 |
| Supervisor dashboard ignores holidays | Business Logic, Data Access | B7 |
| Readiness score untested | Business Logic, Test | T2 |
| DST-unsafe date arithmetic | Business Logic, Scheduler | B-M8 |
| Sequential company processing | Data Access, Scheduler | D12/J14 |
| Missing WHS role in enums | Contract (2 findings) | C-H8, C-H9 |
| RBAC not enforced | Security, Test | S-M10, T-H7 |

---

## Recommended Sprint Roadmap

### Sprint 1: "Stop the Bleeding" (1 week)
*Focus: Security quick wins + formula bug*

- [ ] Fix stress score formula (B1) — **S**
- [ ] Add JWT algorithm restriction (S-H6) — **S**
- [ ] Add security headers via `secureHeaders()` (S-H5) — **S**
- [ ] Strengthen password policy to 12+ chars with complexity (S-H7) — **S**
- [ ] Add rate limiting on auth endpoints (S2) — **M**
- [ ] Configure connection pool + query timeouts (D-H2) — **S**
- [ ] Fix TeamService tenant leak (D-M13) — **S**
- [ ] Add WHS to TeamMember.role and updateUserRoleSchema (C-H8, C-H9) — **S**
- [ ] Add timezone to cron schedules (J-H4) — **S**
- [ ] Add ENABLE_SCHEDULER env toggle (J-H8) — **S**
- [ ] Fix stub job log messages (J-M11) — **S**

### Sprint 2: "Missing Plumbing" (1-2 weeks)
*Focus: Missing endpoints + test foundation*

- [ ] Implement `DELETE /teams/:id` backend route (C1) — **M**
- [ ] Implement `POST /teams/:id/members` backend route (C2) — **M**
- [ ] Implement `DELETE /teams/:id/members/:personId` backend route (C3) — **M**
- [ ] Implement `GET /persons/:id/stats` backend route (C4) — **M**
- [ ] Set up CI pipeline with typecheck + lint + test (T4) — **M**
- [ ] Write readiness score unit tests (T2) — **M**
- [ ] Write missed check-in detector unit tests (T-H9) — **M**
- [ ] Create `missed-check-in.routes.ts` in own module (P1) — **S**
- [ ] Delete 3 dead check-in form components (P-H3) — **S**
- [ ] Consolidate ReadinessBadge implementations (P-H4) — **M**
- [ ] Extract shared validationHook (P-M10) — **S**

### Sprint 3: "Harden Auth" (1-2 weeks)
*Focus: Token revocation + session management*

- [ ] Implement refresh token mechanism (S1) — **L**
- [ ] Invalidate sessions on password change (S-H9) — **M**
- [ ] Add DB re-validation of role/active status in auth middleware (S3) — **M**
- [ ] Fix login email disambiguation across companies (S-H8) — **M**
- [ ] Add login email disambiguation or company selector — **M**
- [ ] Write tenant isolation integration tests (T3) — **L**

### Sprint 4: "Reliability" (1-2 weeks)
*Focus: Scheduler + data access hardening*

- [ ] Implement distributed cron lock (PostgreSQL advisory lock) (J3) — **M**
- [ ] Add graceful shutdown handler (J-H5) — **S**
- [ ] Add job execution tracking/metrics (J-H7) — **M**
- [ ] Add retry logic for failed jobs (J-H6) — **M**
- [ ] Implement daily reminder job (J1) — **M**
- [ ] Implement weekly cleanup job (J2) — **M**
- [ ] Fix incident number generation with DB sequence (B2) — **M**
- [ ] Fix supervisor dashboard compliance calculation (B-H7) — **M**

### Backlog
- Unify snake_case vs camelCase across all API responses (C-M11) — **L**
- Implement full backend test suite (T1) — **XL**
- Add cursor-based pagination for unbounded tables — **L**
- Remove dead endpoints and unused type definitions — **S**
- Expand MSW handlers for full endpoint coverage (T-H8) — **L**
- Add coverage thresholds to vitest config — **S**

---

## Positive Observations

Despite the findings, the codebase demonstrates several strong patterns:

1. **Multi-tenant isolation is architecturally sound** — `BaseRepository` pattern with `this.where()` consistently injects `company_id`. Only 2 queries bypass this.
2. **Auth cookie handling is correct** — httpOnly, secure in production, proper SameSite
3. **Zod validation is consistently applied** on request bodies across most routes
4. **bcrypt with 12 rounds** is a solid hashing choice
5. **JWT secret requires 32+ characters** via env validation
6. **Global error handler** prevents stack trace leakage
7. **Frontend API client** correctly handles credential cookies and 401 redirects
8. **Missed check-in detector** has sophisticated schedule resolution with holiday awareness
9. **Event sourcing pattern** properly records state changes as immutable events
10. **Dashboard service** correctly implements role-specific views with different data shapes

---

*Report generated by 7 parallel Claude Opus 4.6 agents in ~4 minutes total execution time.*
*Total tokens consumed: ~487,952 across all agents.*
