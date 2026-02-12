# How to Review Code in AEGIRA

> Guide para i-review kung tama yung code mo base sa AEGIRA patterns.

---

## Senior Engineer Review (Recommended)

Para sa comprehensive review, gamitin ito:

```
Act as a Senior Software Engineer reviewing code for production readiness.

Review the following code against AEGIRA patterns and best practices:

Files to review:
- src/modules/[feature]/
- src/features/[feature]/

Use these references:
- docs/ai-agent-guidelines/08-code-review-checklist.md
- docs/ai-agent-guidelines/05-security-checklist.md
- docs/ai-agent-guidelines/02-backend-patterns.md
- docs/ai-agent-guidelines/03-frontend-patterns.md

Check for:
1. CRITICAL: Multi-tenant isolation (company_id in all queries)
2. CRITICAL: No direct Prisma in controllers
3. CRITICAL: Auth/authz on all routes
4. HIGH: Query invalidation on mutations
5. HIGH: Error handling with AppError
6. MEDIUM: Code organization and naming
7. LOW: Performance optimizations

Output format:
- Summary with issue counts by severity
- Each issue with file:line, current code, and fix
- List of what's done correctly

Be strict. This is for production.
```

### Example: Full Feature Review

```
Act as a Senior Software Engineer.

Review the check-in feature for production readiness:

Backend:
- src/modules/check-in/check-in.routes.ts
- src/modules/check-in/check-in.controller.ts
- src/modules/check-in/check-in.repository.ts
- src/modules/check-in/check-in.service.ts
- src/modules/check-in/check-in.validator.ts

Frontend:
- src/features/check-in/hooks/useCheckIn.ts
- src/features/check-in/hooks/useSubmitCheckIn.ts
- src/features/check-in/pages/CheckInPage.tsx
- src/features/check-in/pages/CheckInHistoryPage.tsx

Check against docs/ai-agent-guidelines/ rules.
Report all issues with severity and fix recommendations.
```

### Example: Security Audit

```
Act as a Security Engineer.

Perform a security audit on the AEGIRA backend:

Scope: All modules in src/modules/

Check:
1. Multi-tenant isolation - Every query MUST filter by company_id
2. Authentication - All routes have authMiddleware
3. Authorization - Role checks where needed
4. Input validation - Zod schemas for all inputs
5. Sensitive data - No passwords/tokens in responses
6. SQL injection - Prisma used correctly
7. Error messages - No internal details exposed

Reference: docs/ai-agent-guidelines/05-security-checklist.md

Report format:
- CRITICAL: Immediate fix required
- HIGH: Fix before deploy
- MEDIUM: Fix soon
- LOW: Nice to have

Include file:line references for each issue.
```

### Example: Pre-Deployment Review

```
Act as a Tech Lead doing final review before deployment.

Review these changes:
[paste your changed files]

Verify:
1. No breaking changes to API contracts
2. Database queries are optimized (no N+1)
3. Error handling is complete
4. Audit logging in place
5. Tests would pass
6. No console.logs or debug code
7. Environment-specific code handled

Give GO / NO-GO recommendation with reasons.
```

---

## Quick Start

```
/code-review src/modules/[feature]/
```

or

```
/code-review src/features/[feature]/
```

---

## Review Commands

### 1. Review Backend Module

```
/code-review src/modules/team/
```

### 2. Review Frontend Feature

```
/code-review src/features/incident/
```

### 3. Review Multiple Paths

```
/code-review

Backend: src/modules/schedule/
Frontend: src/features/schedule/
```

---

## Review Examples

### Example 1: Specific Module Review

```
Review yung team module ko sa backend:
- src/modules/team/team.routes.ts
- src/modules/team/team.controller.ts
- src/modules/team/team.repository.ts
- src/modules/team/team.validator.ts

Check kung tama yung patterns.
```

### Example 2: Frontend Feature Review

```
Review yung incident feature sa frontend:
- Hooks sa src/features/incident/hooks/
- Pages sa src/features/incident/pages/

Tignan kung:
1. Tama ba yung query keys?
2. May invalidation ba sa mutations?
3. Naka-wrap ba sa PageLoader yung pages?
```

### Example 3: Full Feature Review (Backend + Frontend)

```
Full review ng check-in feature:

Backend:
- src/modules/check-in/

Frontend:
- src/features/check-in/

Check against all patterns in docs/ai-agent-guidelines/
```

### Example 4: Security-Focused Review

```
Security review ng backend ko:

Check lahat ng modules sa src/modules/:
1. May company_id filter ba lahat ng queries?
2. May auth middleware ba lahat ng routes?
3. Walang sensitive data na naka-expose sa response?
4. Validated ba lahat ng inputs with Zod?

Base sa docs/ai-agent-guidelines/05-security-checklist.md
```

### Example 5: Before Commit Review

```
Review before ako mag-commit:

Files changed:
- src/modules/schedule/schedule.controller.ts
- src/modules/schedule/schedule.repository.ts
- src/features/schedule/hooks/useSchedules.ts
- src/features/schedule/pages/AdminSchedulesPage.tsx

Check if ready na for production.
```

### Example 6: Review Specific Patterns Only

```
Check lang yung query hooks ko:
- src/features/team/hooks/useTeams.ts
- src/features/incident/hooks/useIncidents.ts

Verify:
1. QueryKey may lahat ng params?
2. Correct staleTime?
3. May enabled guard for optional IDs?
```

### Example 7: Full System Review

```
Full code review ng AEGIRA system:

Backend modules:
- src/modules/auth/
- src/modules/team/
- src/modules/person/
- src/modules/check-in/
- src/modules/incident/

Frontend features:
- src/features/auth/
- src/features/team/
- src/features/incident/
- src/features/dashboard/

Focus on:
1. Multi-tenant isolation (CRITICAL)
2. Security issues
3. Pattern violations
4. Missing error handling
```

---

## What Gets Checked

### Critical (Must Pass)
- [ ] Multi-tenant isolation - All queries filter by `company_id`
- [ ] No direct Prisma in controllers - Uses repository
- [ ] Auth middleware on all routes
- [ ] No `any` types

### Backend Patterns
- [ ] Module structure: routes → controller → service → repository
- [ ] Middleware chain: auth → tenant → role → zValidator
- [ ] Response format: `{ success: true, data: ... }`
- [ ] Fire-and-forget audit: `logAudit()` (no await, no .catch - handles errors internally)
- [ ] Pagination: uses `parsePagination()` + `paginate()`
- [ ] Errors: uses `AppError` with proper codes
- [ ] Zod validation in validator.ts

### Frontend Patterns
- [ ] Query hooks: all params in queryKey
- [ ] Query hooks: uses `STALE_TIMES` constants
- [ ] Mutations: invalidates related queries in onSuccess
- [ ] Pages: wrapped with `PageLoader`
- [ ] Tables: uses `DataTable` component
- [ ] Columns: defined OUTSIDE component
- [ ] Forms: uses `mutateAsync` + try/catch
- [ ] Forms: toast on success AND error
- [ ] No hardcoded URLs: uses `ENDPOINTS` constant

---

## Review Output Format

Ganito ang output ng review:

```markdown
# Code Review: [Feature Name]

## Summary
- Total files reviewed: 8
- Issues found: 3 (Critical: 0, High: 1, Medium: 2, Low: 0)
- Overall: PASS / NEEDS CHANGES

## Critical Issues
(none)

## High Priority Issues
1. **schedule.repository.ts:45** - Missing company_id filter
   - Current: `where: { is_active: true }`
   - Should be: `where: this.where({ is_active: true })`

## Medium Priority Issues
1. **AdminSchedulesPage.tsx:12** - Columns defined inside component
   - Move columns definition outside the component

2. **useSchedules.ts:8** - Missing query invalidation
   - Add `queryClient.invalidateQueries()` in onSuccess

## What's Good
- Multi-tenant isolation properly implemented
- Zod validation in place
- PageLoader wrapper used correctly
- Error handling with AppError
```

---

## Common Issues Found

### Backend

| Issue | Fix |
|-------|-----|
| Missing company_id filter | Use `this.where()` helper |
| Direct Prisma in controller | Create repository method |
| Awaiting audit log | Use `.catch()` instead of await |
| Missing validation | Add Zod schema in validator.ts |

### Frontend

| Issue | Fix |
|-------|-----|
| Incomplete queryKey | Add all params that affect response |
| No invalidation | Add `invalidateQueries()` in onSuccess |
| Columns inside component | Move outside component |
| Using `mutate` with callbacks | Use `mutateAsync` + try/catch |
| Missing PageLoader | Wrap page content |

---

## Review Personas (Agents)

Gamitin ang personas na ito depende sa need:

### Senior Software Engineer
```
Act as a Senior Software Engineer.
Review [files] for code quality, patterns, and best practices.
Reference: docs/ai-agent-guidelines/
```

### Security Engineer
```
Act as a Security Engineer.
Audit [files] for vulnerabilities and security issues.
Reference: docs/ai-agent-guidelines/05-security-checklist.md
```

### Tech Lead
```
Act as a Tech Lead.
Review [files] for architecture decisions and production readiness.
Give GO/NO-GO recommendation.
```

### Performance Engineer
```
Act as a Performance Engineer.
Review [files] for:
- N+1 queries
- Missing indexes
- Unnecessary re-renders
- Bundle size impact
```

### QA Engineer
```
Act as a QA Engineer.
Review [files] for:
- Edge cases not handled
- Missing error states
- Incomplete validation
- Test coverage gaps
```

---

## Copy-Paste Templates

### Template 1: Quick Review
```
/code-review src/modules/[feature]/
```

### Template 2: Full Feature Review
```
Act as a Senior Software Engineer.

Review [feature] for production:

Backend: src/modules/[feature]/
Frontend: src/features/[feature]/

Check against docs/ai-agent-guidelines/
Report issues with file:line and fixes.
```

### Template 3: Security Audit
```
Act as a Security Engineer.

Security audit ng [feature]:
- src/modules/[feature]/

Check docs/ai-agent-guidelines/05-security-checklist.md
Report all vulnerabilities.
```

### Template 4: Pre-Commit Review
```
Act as a Senior Engineer.

Review before commit:
[list files]

Check patterns, security, and quality.
Approve or request changes.
```

---

## Related Documentation

| Topic | Location |
|-------|----------|
| Security checklist | `docs/ai-agent-guidelines/05-security-checklist.md` |
| Code review checklist | `docs/ai-agent-guidelines/08-code-review-checklist.md` |
| Backend patterns | `docs/ai-agent-guidelines/02-backend-patterns.md` |
| Frontend patterns | `docs/ai-agent-guidelines/03-frontend-patterns.md` |
