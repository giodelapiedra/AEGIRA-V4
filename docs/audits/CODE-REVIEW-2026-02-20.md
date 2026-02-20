# AEGIRA V5 - Logic & Security Code Review

**Review Date:** February 20, 2026
**Scope:** All modified files (61 total: 23 backend, 38 frontend)
**Method:** Automated agent scan → senior engineer verification → targeted fixes
**Overall:** 6 confirmed fixes applied (5 from agent + 1 from manual sweep), 4 false positives rejected, 4 downgraded to nice-to-have

---

## Review Process

1. **Agent scan** — Two parallel review agents ran against all modified files using the `/code-review` skill checklist (security, types, patterns, performance)
2. **Senior verification** — Each finding was manually verified against the actual source code before any changes were made
3. **False positive filtering** — 40% of critical+high findings were rejected after verification (hooks already had `enabled` guards, password policy was intentional, etc.)
4. **Targeted fixes** — Only confirmed real issues were fixed; typecheck passed on both backend and frontend after all changes

---

## Findings Summary

| Severity | Reported | Confirmed | False Positive | Downgraded |
|----------|----------|-----------|----------------|------------|
| Critical | 3 | 2 | 0 | 1 (to Medium) |
| High | 10 | 3 | 4 | 3 (to Medium/Low) |
| Medium | 11 | — | — | Not actioned |
| Low | 7 | — | — | Not actioned |

---

## Fixes Applied

### Fix 1: `admin.repository.ts` — Defense-in-depth for sensitive fields

**Problem:** `updatePersonRole()` (line 275) and `findPersonById()` (line 293) returned the full Prisma `Person` type including `password_hash`. While the admin controller manually picked safe fields before responding, the repository layer should enforce this to prevent future callers from accidentally leaking the hash.

Additionally, `findCompanyById()` (line 84) used `findUnique` which violates the project rule (no `findUnique` — it doesn't support compound `company_id` filtering).

**Changes:**
- `person.repository.ts:12` — Exported `SAFE_PERSON_SELECT` (was private `const`)
- `admin.repository.ts` — Imported `SAFE_PERSON_SELECT` and `SafePerson` from person repository
- `admin.repository.ts:84` — Changed `findUnique` → `findFirst` for Company lookup
- `admin.repository.ts:275` — Added `select: SAFE_PERSON_SELECT` to `updatePersonRole`, return type → `SafePerson`
- `admin.repository.ts:293` — Added `select: SAFE_PERSON_SELECT` to `findPersonById`, return type → `SafePerson`

**Risk:** Low — the controller already manually picked safe fields, so `password_hash` was never sent to the client. This is a defense-in-depth improvement.

---

### Fix 2: `MemberInfoCard.tsx` — Timezone-aware age calculation

**Problem:** `calculateAge()` (line 17) used `new Date()` for the current date, which uses the browser's local timezone. This contradicts the BUG-A P2 fix (2026-02-16) already applied in `SettingsPage.tsx` where the same function was updated to use Luxon with company timezone.

Near midnight across timezone boundaries, this causes an off-by-one year in the displayed age.

**Changes:**
- Added `DateTime` import from `luxon` and `useAuth` import
- `calculateAge()` now takes a `timezone` parameter and uses `DateTime.fromISO()` + `DateTime.now().setZone(timezone)` — matching the SettingsPage pattern exactly
- Component body calls `useAuth()` to get `user.companyTimezone`
- Fallback to `'Asia/Manila'` if timezone unavailable

---

### Fix 3: `incident.service.ts` — Timezone-aware incident reference number

**Problem:** `formatIncidentRef()` (line 401) used `createdAt.getFullYear()` which returns the UTC year from the JS Date object. An incident created at 7 AM Manila time on Jan 1 (= 11 PM Dec 31 UTC) would get the previous year in its reference number (e.g., `INC-2025-0001` instead of `INC-2026-0001`).

Meanwhile, `formatCaseRef()` (line 406) already correctly used `DateTime.now().setZone(this.timezone).toFormat('yyyy')`.

**Change:**
- `createdAt.getFullYear()` → `DateTime.fromJSDate(createdAt).setZone(this.timezone).year`

**Note:** Uses `this.timezone` which is set from the company timezone in the constructor. `DateTime` was already imported in the file.

---

### Fix 4: `AdminWorkerEditPage.tsx` — Await async mutation in dialog

**Problem:** The `onConfirm` callback in the transfer confirmation dialog (line 557) called `submitUpdate(pendingFormData)` without `await`. Since `submitUpdate` is `async` (line 196), the dialog would close immediately while the mutation was still in-flight. If the mutation failed, the error toast would appear without context (dialog already closed).

**Change:**
- `onConfirm={() => {` → `onConfirm={async () => {`
- `submitUpdate(pendingFormData);` → `await submitUpdate(pendingFormData);`

This ensures the dialog stays open until the mutation completes, and `setPendingFormData(null)` only runs after success.

---

### Fix 5: `WorkerExportButton.tsx` — Timezone-aware age in CSV export

**Problem:** `calculateAge()` (line 97) used `new Date()` — identical to the MemberInfoCard bug. Found during post-fix sweep of all `calculateAge` instances across the codebase.

**Changes:**
- `calculateAge()` now takes a `timezone` parameter and uses `DateTime.fromISO()` + `DateTime.now().setZone(timezone)`
- `buildProfileSection()` now accepts and passes `timezone`
- Component body calls `useAuth()` to get `user.companyTimezone`
- Added `useAuth` import

**Note:** This was missed by the initial agent scan. Manual sweep after fixing MemberInfoCard caught it.

---

## False Positives Rejected

### FP-1: `CaseDetailPage.tsx:80` + `IncidentDetailPage.tsx:58` — "Missing `enabled` guard"

**Agent claim:** `useCase(id || '')` and `useIncident(id || '')` fire with empty string when route param is missing.

**Verification:** The hooks `useCase`, `useIncident`, and `useIncidentTimeline` ALL have `enabled: !!caseId` / `enabled: !!incidentId` inside their definitions. When `id || ''` resolves to `''`, `enabled: !!''` evaluates to `false` — the query never fires.

**Verdict:** Not a bug. The `enabled` guard is in the hook layer, not the page layer. Both approaches are valid.

### FP-2: `person.validator.ts:8` — "Password min 8 vs signup min 12"

**Agent claim:** Inconsistent password policy between admin-created workers (8 chars) and self-service signup (12 chars with complexity).

**Verification:** This is intentional. Admin-created worker accounts have a simpler initial password set by the admin. The signup path is public-facing (company registration) and requires stronger passwords. Workers can change their password later (which enforces 12 chars + complexity via `changePasswordSchema`).

**Verdict:** Design decision, not a bug.

### FP-3: `auth.controller.ts:68` — "Login finds first email across companies"

**Agent claim:** If the same email exists in multiple active companies, login returns the most recently created account. User can't choose which company.

**Verification:** This is a known design limitation. The schema allows `@@unique([company_id, email])` (same email in different companies). Adding a company identifier at login would be a feature request requiring UI changes. The current `orderBy: { created_at: 'desc' }` is deterministic.

**Verdict:** Architecture decision. Logged as a future consideration, not a bug fix.

### FP-4: `person.controller.ts:121` — "Error reflects raw input"

**Agent claim:** `Invalid role filter: ${roleParam}` reflects user input in error message, enabling "reflected content injection."

**Verification:** The response is JSON (`Content-Type: application/json`), not HTML. The role values are well-known enums (`ADMIN`, `WHS`, `SUPERVISOR`, `TEAM_LEAD`, `WORKER`). No XSS vector exists in a JSON API. The error message helps the client understand what went wrong.

**Verdict:** Not a security risk in a JSON API context.

---

## Downgraded Findings (Not Actioned)

| Finding | Original | Downgraded To | Reason |
|---------|----------|---------------|--------|
| `TeamAnalyticsPage.tsx` inline useQuery | High | Medium | Pattern violation, not a bug. Works correctly. |
| `MemberCheckInTable.tsx:59` missing `?.` on readinessResult | Critical | Low | Transform always produces `readinessResult`. Defensive coding, not a crash risk. |
| `admin.repository.ts:84` findUnique on Company | Critical | Low | Company is tenancy root — zero cross-tenant risk. Fixed anyway for pattern consistency. |

---

## Verification

```
Backend typecheck:  PASS (0 errors)
Frontend typecheck: PASS (0 errors)
```

---

## Files Modified

| File | Lines Changed |
|------|--------------|
| `aegira-backend/src/modules/person/person.repository.ts` | 1 (export SAFE_PERSON_SELECT) |
| `aegira-backend/src/modules/admin/admin.repository.ts` | 4 (import, findFirst, 2x select) |
| `aegira-backend/src/modules/incident/incident.service.ts` | 1 (Luxon year) |
| `aegira-frontend/src/features/team/components/MemberInfoCard.tsx` | 3 (imports, Luxon calculateAge, useAuth) |
| `aegira-frontend/src/features/team/components/WorkerExportButton.tsx` | 4 (import, Luxon calculateAge, useAuth, pass timezone) |
| `aegira-frontend/src/features/admin/pages/AdminWorkerEditPage.tsx` | 2 (async + await) |
