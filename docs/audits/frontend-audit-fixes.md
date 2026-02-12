# AEGIRA Frontend - Code Audit Fixes

> **Audit Date**: 2026-02-02
> **Audited By**: Senior Engineer Review (Claude Code)
> **Scope**: All `src/` files — hooks, pages, components, lib, types, config, stores, routes
> **Rules Reference**: `CLAUDE.md` + `aegira-frontend/CLAUDE.md`
> **Backend Verified**: Yes — checked actual API response formats per module

---

## Overview

| Severity | Count | Fixed |
|----------|:-----:|:-----:|
| CRITICAL | 4 | 4 |
| MEDIUM | 20 | 20 |
| LOW | 35 | 33 |
| **Total** | **59** | **57** |

> **FE-017** (PageLoader on 3 static pages) and **FE-018** (inline styles → CSS) deferred — cosmetic only, no runtime impact.

### Priority Fix Order

1. **CRITICAL** — Type safety & architecture (can cause silent runtime failures)
2. **MEDIUM** — Cache invalidation, form patterns, hardcoded routes (stale UI, pattern inconsistency)
3. **LOW** — Convention violations, dead code, minor cleanup (code quality)

---

## Backend API Response Format Reference

> **Verified 2026-02-02** — The backend has **NO global snake_case-to-camelCase transformer**.
> Each module individually decides its response format. The table below is the ground truth.

| Module / Endpoint | Returns | Method |
|-------------------|---------|--------|
| **Auth** (`login`, `me`, `signup`) | **camelCase** | Manual `formatUserResponse()` |
| **Person** (CRUD, list, profile) | **snake_case** | Raw Prisma output |
| **Person** (`uploadAvatar`) | **camelCase** | Manual (just `profilePictureUrl`) |
| **Team** (CRUD, list, members, myMembers) | **snake_case** | Raw Prisma output |
| **Team** (`checkInHistory`, `analytics`) | **camelCase** | Manual `.map()` transform |
| **Check-In** (submit, today, history) | **snake_case** | Raw Prisma output |
| **Check-In** (`status`) | **camelCase** | Manual in service |
| **Notification** (list, markAsRead) | **snake_case** | Raw Prisma output |
| **Notification** (`unreadCount`, `markAllAsRead`) | **camelCase** | Manual |
| **Dashboard** (all endpoints) | **camelCase** | Manual in service |
| **Admin** (holidays, audit, amendments, settings) | **camelCase** | Manual transform |
| **Admin** (`listUserRoles`) | **snake_case** | Raw Prisma output |
| **Missed Check-In** (list) | **camelCase** | Manual `.map()` transform |
| **Missed Check-In** (update status) | **snake_case** | Raw Prisma output |

---

## Section 1: CRITICAL — Type Safety & Architecture

### FE-001 | Mixed snake_case / camelCase in frontend types — RECLASSIFIED

- **Severity**: ~~CRITICAL~~ **INFORMATIONAL (No frontend fix needed)**
- **Rule**: `CLAUDE.md` — *"Frontend/Backend variables: `camelCase`"*
- **Backend Verification Result**: The snake_case types in the frontend are **CORRECT** — they accurately match what the backend API returns for those endpoints.

**Root Cause**: The inconsistency is in the **backend**, not the frontend. Endpoints that return raw Prisma output send snake_case; endpoints with manual transforms send camelCase. The frontend types correctly reflect this.

**Affected Types (all currently correct):**

| Frontend Type | Backend Endpoint | Backend Returns | Frontend Matches? |
|---------------|-----------------|-----------------|:-----------------:|
| `Person` (snake_case) | `GET /persons/:id` | snake_case (raw Prisma) | YES |
| `Team` (snake_case) | `GET /teams/:id` | snake_case (raw Prisma) | YES |
| `TeamMember` (snake_case) | `GET /teams/:id/members` | snake_case (raw Prisma) | YES |
| `Notification` (snake_case) | `GET /notifications` | snake_case (raw Prisma) | YES |
| `CheckIn` (camelCase) | `GET /check-ins/today` | snake_case — **has transform in hook** | YES |
| `User` / Auth (camelCase) | `GET /auth/me` | camelCase (manual transform) | YES |
| Dashboard stats (camelCase) | `GET /dashboard/*` | camelCase (manual transform) | YES |

**DO NOT change frontend types to camelCase** — the app will break because the API still sends snake_case for Person, Team, TeamMember, and Notification.

**Proper fix (backend-side, not in this doc's scope):**
- Option A: Add `formatPersonResponse()` transform in backend Person controller (like Auth already has)
- Option B: Add a global Hono middleware that converts all response keys to camelCase
- Option C: Keep as-is — it works, the frontend types match the API

> **Status**: No frontend action required. Backend inconsistency documented for future cleanup.

- [x] Verified — frontend types match backend responses. No fix needed.

---

### FE-002 | RouteGuard `allowedRoles` typed as `string[]` instead of `UserRole[]`

- **Severity**: CRITICAL
- **Rule**: `CLAUDE.md` — *"NO `any` types — strict TypeScript everywhere"*
- **Files**: `src/routes/RouteGuard.tsx:8`, `src/lib/hooks/use-auth.ts:14`
- **Impact**: A typo like `allowedRoles={['ADMIM']}` compiles without error but silently denies all access at runtime.

**Fix RouteGuard.tsx:**

```typescript
// BEFORE
import { ROUTES } from '@/config/routes.config';

interface RouteGuardProps {
  children?: React.ReactNode;
  allowedRoles?: string[];   // <-- weak typing
}

// AFTER
import { ROUTES } from '@/config/routes.config';
import type { UserRole } from '@/types/auth.types';

interface RouteGuardProps {
  children?: React.ReactNode;
  allowedRoles?: UserRole[];  // <-- strict typing
}
```

**Fix use-auth.ts:**

```typescript
// BEFORE
const hasRole = (roles: string[]) => {

// AFTER
import type { UserRole } from '@/types/auth.types';

const hasRole = (roles: UserRole[]) => {
```

- [ ] Fix `RouteGuard.tsx:8`
- [ ] Fix `use-auth.ts:14`

---

### FE-003 | Duplicate `User` type definitions

- **Severity**: CRITICAL
- **Rule**: `CLAUDE.md` — *"Consistency > preference"*, `CLAUDE.md` — *"Define types in `src/types/`"*
- **Files**: `src/stores/auth.store.ts:3-15` vs `src/types/auth.types.ts:13-26`
- **Impact**: `User` in `auth.store.ts` has `profilePictureUrl`, `gender`, `dateOfBirth`. `AuthResponse.user` in `auth.types.ts` is a separate inline type. They can drift out of sync.

**Fix**: Define `User` once in `src/types/auth.types.ts` and import it everywhere.

```typescript
// AFTER — src/types/auth.types.ts
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE' | null;
  dateOfBirth: string | null;
  profilePictureUrl: string | null;
  role: UserRole;
  companyId: string;
  companyName: string;
  companyTimezone: string;
}

export interface AuthResponse {
  user: User;  // Reuse the User interface
}

// AFTER — src/stores/auth.store.ts
import type { User } from '@/types/auth.types';
// Remove the local User interface definition

export { type User };  // Re-export for convenience
```

- [ ] Move `User` to `src/types/auth.types.ts`
- [ ] Update `AuthResponse` to reference `User`
- [ ] Update `auth.store.ts` to import `User`
- [ ] Update all other imports of `User` from `auth.store.ts`

---

### FE-004 | `User.role` uses inline union instead of `UserRole` type

- **Severity**: CRITICAL
- **File**: `src/stores/auth.store.ts:11`
- **Rule**: `CLAUDE.md` — *"Consistency > preference"*
- **Impact**: `UserRole` is already defined in `auth.types.ts:29` but not used here.

```typescript
// BEFORE (auth.store.ts:11)
role: 'WORKER' | 'TEAM_LEAD' | 'SUPERVISOR' | 'ADMIN';

// AFTER (resolved by FE-003 — User moves to auth.types.ts and uses UserRole)
role: UserRole;
```

> This is resolved as part of FE-003. No separate action needed.

- [ ] Resolved with FE-003

---

### FE-005 | `ROLE_LABELS` uses `Record<string, string>` instead of `Record<UserRole, string>`

- **Severity**: CRITICAL
- **File**: `src/lib/utils/format.utils.ts:91`
- **Rule**: Strict TypeScript

```typescript
// BEFORE
export const ROLE_LABELS: Record<string, string> = {

// AFTER
import type { UserRole } from '@/types/auth.types';

export const ROLE_LABELS: Record<UserRole, string> = {
```

Also fix `getReadinessLabel` at line 77:

```typescript
// BEFORE
export function getReadinessLabel(category: string): string {
  const labels: Record<string, string> = {

// AFTER
import type { ReadinessCategory } from '@/types/check-in.types';

export function getReadinessLabel(category: ReadinessCategory): string {
  const labels: Record<ReadinessCategory, string> = {
```

- [ ] Fix `ROLE_LABELS` typing
- [ ] Fix `getReadinessLabel` typing

---

## Section 2: MEDIUM — Cache Invalidation & API Client

### FE-006 | `useUpdateProfile` missing `onSuccess` invalidation

- **Severity**: MEDIUM
- **File**: `src/features/auth/hooks/useUpdateProfile.ts:12-17`
- **Rule**: *"Mutations MUST invalidate related queries in onSuccess"*
- **Impact**: After updating profile, the UI shows stale name/profile data until page refresh.

```typescript
// BEFORE
export function useUpdateProfile() {
  return useMutation({
    mutationFn: (data: UpdateProfileData) =>
      apiClient.patch<{ message: string }>(ENDPOINTS.PERSON.UPDATE_PROFILE, data),
  });
}

// AFTER
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileData) =>
      apiClient.patch<{ message: string }>(ENDPOINTS.PERSON.UPDATE_PROFILE, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'session'] });
      queryClient.invalidateQueries({ queryKey: ['persons'] });
    },
  });
}
```

- [ ] Add `onSuccess` with cache invalidation

---

### FE-007 | `useUploadAvatar` missing `onSuccess` invalidation

- **Severity**: MEDIUM
- **File**: `src/features/auth/hooks/useUploadAvatar.ts:9-17`
- **Rule**: *"Mutations MUST invalidate related queries in onSuccess"*
- **Impact**: After uploading avatar, the header/sidebar still shows old avatar until refresh.

```typescript
// AFTER
export function useUploadAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('avatar', file);
      return apiClient.upload<UploadAvatarResponse>(ENDPOINTS.PERSON.UPLOAD_AVATAR, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'session'] });
      queryClient.invalidateQueries({ queryKey: ['persons'] });
    },
  });
}
```

- [ ] Add `onSuccess` with cache invalidation

---

### FE-008 | `useChangePassword` missing `onSuccess`

- **Severity**: MEDIUM (borderline LOW)
- **File**: `src/features/auth/hooks/useChangePassword.ts:10-15`
- **Rule**: *"Mutations MUST invalidate related queries in onSuccess"*

```typescript
// AFTER — at minimum, add an empty onSuccess for consistency
export function useChangePassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ChangePasswordData) =>
      apiClient.patch<{ message: string }>(ENDPOINTS.AUTH.CHANGE_PASSWORD, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'session'] });
    },
  });
}
```

- [ ] Add `onSuccess`

---

### FE-009 | `ENDPOINTS.AUTH.LOGOUT` missing from 401 exception list

- **Severity**: MEDIUM
- **File**: `src/lib/api/client.ts:6`
- **Impact**: If cookie is already expired when logout is called, the 401 handler fires and redirects before the logout mutation's `onSuccess` cleanup can run. Race condition.

```typescript
// BEFORE
const AUTH_ENDPOINTS = [ENDPOINTS.AUTH.LOGIN, ENDPOINTS.AUTH.SIGNUP, ENDPOINTS.AUTH.ME];

// AFTER
const AUTH_ENDPOINTS = [
  ENDPOINTS.AUTH.LOGIN,
  ENDPOINTS.AUTH.SIGNUP,
  ENDPOINTS.AUTH.ME,
  ENDPOINTS.AUTH.LOGOUT,
];
```

- [ ] Add `ENDPOINTS.AUTH.LOGOUT` to exception list

---

## Section 3: MEDIUM — Form Patterns

### FE-010 | `mutate` with callbacks instead of `mutateAsync` + try/catch

- **Severity**: MEDIUM
- **Rule**: *"Use `mutateAsync` + try/catch for form submissions"*
- **Impact**: Inconsistent error handling pattern across the codebase.

| # | File | Location |
|---|------|----------|
| 1 | `src/features/auth/pages/SettingsPage.tsx` | `onPasswordSubmit` (~line 110) |
| 2 | `src/features/auth/pages/SettingsPage.tsx` | `onProfileSubmit` (~line 129) |
| 3 | `src/features/auth/pages/SettingsPage.tsx` | `handleFileChange` (~line 212) |
| 4 | `src/features/check-in/components/CheckInForm.tsx` | `onSubmit` (~line 47) |
| 5 | `src/features/check-in/components/CheckInFormImproved.tsx` | `handleSubmit` (~line 37) |
| 6 | `src/features/check-in/components/CheckInFormComplete.tsx` | `onSubmit` (~line 134) |
| 7 | `src/features/admin/pages/AdminAuditLogsPage.tsx` | `onVerify` (~line 97) |

**Fix pattern** (apply to all 7):

```typescript
// BEFORE
mutation.mutate(data, {
  onSuccess: () => { toast({ title: 'Success' }); },
  onError: (error) => { toast({ title: 'Error', variant: 'destructive' }); },
});

// AFTER
const onSubmit = async (data: FormData) => {
  try {
    await mutation.mutateAsync(data);
    toast({ title: 'Success', description: '...' });
    // navigate, reset, etc.
  } catch (error) {
    toast({
      title: 'Error',
      description: error instanceof Error ? error.message : 'Operation failed',
      variant: 'destructive',
    });
  }
};
```

- [ ] Fix `SettingsPage.tsx` — `onPasswordSubmit`
- [ ] Fix `SettingsPage.tsx` — `onProfileSubmit`
- [ ] Fix `SettingsPage.tsx` — `handleFileChange`
- [ ] Fix `CheckInForm.tsx` — `onSubmit`
- [ ] Fix `CheckInFormImproved.tsx` — `handleSubmit`
- [ ] Fix `CheckInFormComplete.tsx` — `onSubmit`
- [ ] Fix `AdminAuditLogsPage.tsx` — `onVerify`

---

### FE-011 | Missing `defaultValues` in `useForm`

- **Severity**: MEDIUM
- **Rule**: *"ALWAYS provide `defaultValues`"*
- **Impact**: React Hook Form warns about switching from uncontrolled to controlled inputs. Can cause subtle form bugs.

| # | File | Missing defaults |
|---|------|------------------|
| 1 | `src/features/auth/pages/LoginPage.tsx:25-31` | `email`, `password` |
| 2 | `src/features/auth/pages/SettingsPage.tsx:80-87` | All password change fields |
| 3 | `src/features/admin/pages/AdminAuditLogsPage.tsx:87-94` | All verify fields |
| 4 | `src/features/admin/pages/AdminWorkerCreatePage.tsx:46-51` | `email`, `password`, `firstName`, `lastName`, `teamId` |
| 5 | `src/features/admin/pages/AdminTeamCreatePage.tsx:51-58` | `name`, `description`, `leaderId`, `supervisorId` |

**Fix pattern:**

```typescript
// BEFORE (LoginPage.tsx)
const form = useForm<LoginFormData>({
  resolver: zodResolver(loginSchema),
});

// AFTER
const form = useForm<LoginFormData>({
  resolver: zodResolver(loginSchema),
  defaultValues: {
    email: '',
    password: '',
  },
});
```

- [ ] Fix `LoginPage.tsx`
- [ ] Fix `SettingsPage.tsx` password form
- [ ] Fix `AdminAuditLogsPage.tsx`
- [ ] Fix `AdminWorkerCreatePage.tsx`
- [ ] Fix `AdminTeamCreatePage.tsx`

---

### FE-012 | Missing `form.formState.isSubmitting` on submit buttons

- **Severity**: MEDIUM
- **Rule**: *"Use `form.formState.isSubmitting` to disable submit button"*

| # | File | Currently uses |
|---|------|----------------|
| 1 | `src/features/auth/pages/LoginPage.tsx:140` | `loginMutation.isPending` |
| 2 | `src/features/auth/pages/SignupPage.tsx:375` | `signupMutation.isPending` |
| 3 | `src/features/check-in/components/CheckInFormComplete.tsx:555` | `submitMutation.isPending` |
| 4 | `src/features/check-in/components/CheckInForm.tsx:144` | `submitMutation.isPending` |

**Fix pattern** (best practice — use both):

```typescript
// AFTER
<Button
  type="submit"
  disabled={form.formState.isSubmitting || mutation.isPending}
>
```

- [ ] Fix all 4 occurrences

---

## Section 4: MEDIUM — Hardcoded Routes

### FE-013 | Hardcoded route paths instead of `ROUTES` constants

- **Severity**: MEDIUM
- **Rule**: *"Use `ROUTES` constants — never hardcode paths"*
- **Impact**: If routes are renamed, hardcoded strings won't update and will 404.

| # | File | Line | Hardcoded path | Fix |
|---|------|------|----------------|-----|
| 1 | `src/features/team/pages/TeamsPage.tsx` | ~102 | `` `/team/${team.id}` `` | Use a helper or `ROUTES.TEAM_DETAIL.replace(':teamId', team.id)` |
| 2 | `src/features/team/pages/TeamsPage.tsx` | ~130-136 | `` `/team/${team.id}` `` | Same as above |
| 3 | `src/features/person/pages/PersonsPage.tsx` | ~117 | `` `/person/${person.id}` `` | `ROUTES.PERSON_DETAIL.replace(':personId', person.id)` |
| 4 | `src/features/person/pages/PersonsPage.tsx` | ~147 | `` `/person/${person.id}` `` | Same as above |
| 5 | `src/features/team/pages/TeamMembersPage.tsx` | ~81 | `` `/team/workers/${member.id}` `` | `ROUTES.TEAM_WORKER_DETAIL.replace(':workerId', member.id)` |
| 6 | `src/features/admin/pages/AdminSchedulesPage.tsx` | ~102 | `` `/admin/teams/${team.id}/edit` `` | `ROUTES.ADMIN_TEAMS_EDIT.replace(':teamId', team.id)` |

**Recommended**: Add a route helper utility in `src/lib/utils/`:

```typescript
// src/lib/utils/route.utils.ts
export function buildRoute(route: string, params: Record<string, string>): string {
  return Object.entries(params).reduce(
    (path, [key, value]) => path.replace(`:${key}`, value),
    route
  );
}

// Usage
navigate(buildRoute(ROUTES.TEAM_DETAIL, { teamId: team.id }));
```

- [ ] Create `route.utils.ts` helper
- [ ] Fix `TeamsPage.tsx` (2 locations)
- [ ] Fix `PersonsPage.tsx` (2 locations)
- [ ] Fix `TeamMembersPage.tsx`
- [ ] Fix `AdminSchedulesPage.tsx`

---

## Section 5: LOW — Hook Pattern Violations

### FE-014 | URLSearchParams not used for query params

- **Severity**: LOW
- **Rule**: *"Build query params with `URLSearchParams` — never concatenate strings manually"*

| # | File | Line | Current |
|---|------|------|---------|
| 1 | `src/features/check-in/hooks/useCheckInHistory.ts` | 56 | `` `?page=${page}&pageSize=${pageSize}` `` |
| 2 | `src/features/team/hooks/useTeams.ts` | 73 | `` `?page=${page}&limit=${limit}` `` |
| 3 | `src/features/person/hooks/usePersons.ts` | 68 | `?role=SUPERVISOR&limit=100` |
| 4 | `src/features/notifications/hooks/useNotifications.ts` | 44 | `?page=1&limit=5` |

**Fix pattern:**

```typescript
// BEFORE (useCheckInHistory.ts:54-56)
const data = await apiClient.get<BackendPaginatedResponse>(
  `${ENDPOINTS.CHECK_IN.HISTORY}?page=${page}&pageSize=${pageSize}`
);

// AFTER
const params = new URLSearchParams({
  page: String(page),
  pageSize: String(pageSize),
});
const data = await apiClient.get<BackendPaginatedResponse>(
  `${ENDPOINTS.CHECK_IN.HISTORY}?${params.toString()}`
);
```

- [ ] Fix `useCheckInHistory.ts`
- [ ] Fix `useTeamMembers` in `useTeams.ts`
- [ ] Fix `useSupervisors` in `usePersons.ts`
- [ ] Fix `useNotificationPreview` in `useNotifications.ts`

---

### FE-015 | Missing type re-exports from hooks

- **Severity**: LOW
- **Rule**: *"Re-export types from hooks for convenience"*
- **Impact**: Consumers must import types from `src/types/` separately instead of from the hook file.

**Hooks that correctly re-export (reference):**
- `src/features/team/hooks/useTeams.ts:16` — `export type { Team, TeamMember, ... }`
- `src/features/person/hooks/usePersons.ts:9` — `export type { Person, PersonStats, ... }`

**Hooks missing re-exports:**

| # | File | Types to re-export |
|---|------|--------------------|
| 1 | `src/features/check-in/hooks/useTodayCheckIn.ts` | `CheckIn`, `ReadinessFactor` |
| 2 | `src/features/check-in/hooks/useCheckInHistory.ts` | `CheckIn`, `CheckInHistory` |
| 3 | `src/features/check-in/hooks/useSubmitCheckIn.ts` | `CheckInSubmission`, `CheckIn` |
| 4 | `src/features/team/hooks/useWorkerCheckIns.ts` | `CheckIn`, `CheckInHistory` |
| 5 | `src/features/team/hooks/useWorkerMissedCheckIns.ts` | `MissedCheckInsResponse`, `UseWorkerMissedCheckInsParams` |
| 6 | `src/features/notifications/hooks/useNotifications.ts` | `Notification`, `NotificationUnreadCount` |
| 7 | `src/features/dashboard/hooks/useDashboardStats.ts` | `WorkerDashboardStats`, `TeamLeadDashboardStats`, `SupervisorDashboardStats`, `AdminDashboardStats` |
| 8 | `src/features/auth/hooks/useLogin.ts` | `LoginCredentials`, `AuthResponse` |
| 9 | `src/features/auth/hooks/useSignup.ts` | `AuthResponse` |
| 10 | `src/features/auth/hooks/useChangePassword.ts` | `ChangePasswordData` (local, not exported) |
| 11 | `src/features/auth/hooks/useUpdateProfile.ts` | `UpdateProfileData` (local, not exported) |
| 12 | `src/features/auth/hooks/useUploadAvatar.ts` | `UploadAvatarResponse` (local, not exported) |

**Fix pattern:**

```typescript
// Add at the top of the hook file, after imports:
export type { CheckIn, CheckInHistory } from '@/types/check-in.types';

// For locally defined types, add export:
export interface ChangePasswordData {  // was: interface ChangePasswordData
```

- [ ] Fix all 12 hook files

---

## Section 6: LOW — Component Pattern Violations

### FE-016 | DataTable columns defined INSIDE component

- **Severity**: LOW
- **Rule**: *"Define columns OUTSIDE the component (prevents re-renders)"*

| # | File | Lines |
|---|------|-------|
| 1 | `src/features/team/pages/MissedCheckInsPage.tsx` | ~162-209 |
| 2 | `src/features/admin/pages/AdminHolidaysPage.tsx` | ~139-178 |

**Fix**: Extract columns to module scope. If columns reference component handlers (e.g., `handleDelete`), use `useMemo` or pass actions via a column helper pattern:

```typescript
// If columns need access to handlers, use a factory function:
const getColumns = (onDelete: (id: string) => void): ColumnDef<Holiday>[] => [
  // ... columns that reference onDelete
];

// Inside component:
const columns = useMemo(() => getColumns(handleDelete), [handleDelete]);
```

- [ ] Fix `MissedCheckInsPage.tsx`
- [ ] Fix `AdminHolidaysPage.tsx`

---

### FE-017 | Missing `PageLoader` wrapper

- **Severity**: LOW
- **Rule**: *"ALWAYS wrap page content with `<PageLoader>`"*

| # | File | Issue |
|---|------|-------|
| 1 | `src/features/team/pages/TeamReportsPage.tsx` | Static placeholder, no loading state |
| 2 | `src/features/schedule/pages/MySchedulePage.tsx` | Static placeholder, no loading state |
| 3 | `src/features/team/pages/TeamWorkerDetailPage.tsx` | No skeleton, uses hard `ErrorMessage` fallback only |

- [ ] Add `PageLoader` to all 3 pages

---

### FE-018 | Inline styles instead of Tailwind

- **Severity**: LOW
- **Rule**: *"Tailwind CSS only — NO inline styles"*

| # | File | Line | Purpose | Acceptable? |
|---|------|------|---------|:-----------:|
| 1 | `src/features/auth/pages/LoginPage.tsx` | ~58 | Background pattern SVG | No |
| 2 | `src/features/auth/pages/LoginPage.tsx` | ~91 | Dot grid pattern | No |
| 3 | `src/features/auth/pages/SignupPage.tsx` | ~136 | Background pattern SVG | No |
| 4 | `src/features/auth/pages/SignupPage.tsx` | ~186 | Dot grid pattern | No |
| 5 | `src/features/check-in/pages/CheckInPage.tsx` | ~131 | Dynamic width `%` | Yes (dynamic) |
| 6 | `src/features/check-in/components/ReadinessIndicator.tsx` | ~98 | SVG stroke animation | Yes (SVG) |
| 7 | `src/features/check-in/components/CheckInFormComplete.tsx` | ~212 | Progress bar width `%` | Yes (dynamic) |

**Fix for #1-4**: Move background patterns to CSS classes in `globals.css` or use Tailwind arbitrary values:

```css
/* globals.css */
.bg-industrial-pattern {
  background-image: url('/assets/industrial-pattern.svg');
  background-size: 300px 300px;
  background-repeat: repeat;
}

.bg-dot-grid {
  background-image: radial-gradient(circle, #c0c5cc 1.2px, transparent 1.2px);
  background-size: 24px 24px;
}
```

> Items 5-7 are acceptable exceptions since they require runtime-computed values.

- [ ] Fix login/signup background patterns (#1-4)

---

## Section 7: LOW — Props & TypeScript

### FE-019 | Missing explicit `interface` for component props

- **Severity**: LOW
- **Rule**: *"Explicit `interface` for all component props"*

| # | File | Component | Current |
|---|------|-----------|---------|
| 1 | `src/features/auth/pages/SettingsPage.tsx:58` | `InfoItem` | `{ icon, label, value }: { icon: ReactNode; ... }` |
| 2 | `src/features/team/components/MemberInfoCard.tsx:33` | `InfoItem` | `{ label, value, icon }: { label: string; ... }` |
| 3 | `src/features/check-in/components/ReadinessIndicator.tsx:131` | `ReadinessBadge` | `{ category }: { category: ReadinessCategory }` |

**Fix pattern:**

```typescript
// BEFORE
function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {

// AFTER
interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function InfoItem({ icon, label, value }: InfoItemProps) {
```

- [ ] Fix all 3 components

---

## Section 8: LOW — Dead Code & Cleanup

### FE-020 | Dead/unused endpoints

- **Severity**: LOW
- **File**: `src/lib/api/endpoints.ts`

| Endpoint | Line | Issue |
|----------|------|-------|
| `ENDPOINTS.AUTH.REGISTER` | 10 | Never used. Duplicate of `SIGNUP` |
| `ENDPOINTS.AUTH.REFRESH` | 13 | Never used in frontend |
| `ENDPOINTS.HEALTH` | 74 | Never used in frontend |

```typescript
// Remove these 3 dead endpoints:
// REGISTER: '/auth/register',   // line 10 — DELETE
// REFRESH: '/auth/refresh',     // line 13 — DELETE
// HEALTH: '/health',            // line 74 — DELETE
```

- [ ] Remove 3 dead endpoints

---

### FE-021 | Duplicate endpoint aliases

- **Severity**: LOW
- **File**: `src/lib/api/endpoints.ts:40-47`

| Alias A | Alias B | Both produce |
|---------|---------|-------------|
| `TEAM.DETAIL(id)` | `TEAM.BY_ID(id)` | `/teams/${id}` |
| `TEAM.MEMBERS(id)` | `TEAM.ADD_MEMBER(id)` | `/teams/${id}/members` |
| `TEAM.MEMBER(tId, pId)` | `TEAM.REMOVE_MEMBER(tId, pId)` | `/teams/${tId}/members/${pId}` |

**Fix**: Keep semantic aliases but add comments clearly indicating they resolve to the same URL, or consolidate to single entries used with different HTTP methods.

- [ ] Consolidate or document duplicate aliases

---

### FE-022 | `process.env.NODE_ENV` in Vite project

- **Severity**: LOW
- **File**: `src/lib/hooks/use-toast.tsx:70`

```typescript
// BEFORE
} else if (process.env.NODE_ENV === 'development') {

// AFTER
} else if (import.meta.env.DEV) {
```

- [ ] Fix to use `import.meta.env.DEV`

---

### FE-023 | `CheckInHistory` duplicates `PaginatedResponse<CheckIn>`

- **Severity**: LOW
- **File**: `src/types/check-in.types.ts:92-98`
- **Impact**: Uses `pageSize` while `PaginatedResponse` uses `limit`. Inconsistent pagination field naming.

```typescript
// BEFORE
export interface CheckInHistory {
  items: CheckIn[];
  total: number;
  page: number;
  pageSize: number;     // inconsistent with PaginatedResponse.pagination.limit
  totalPages: number;
}

// AFTER — reuse PaginatedResponse or align field names
// Option A: Just use PaginatedResponse<CheckIn> in the hook
// Option B: Align the field name
export interface CheckInHistory {
  items: CheckIn[];
  total: number;
  page: number;
  limit: number;        // aligned with PaginatedResponse
  totalPages: number;
}
```

- [ ] Align or remove `CheckInHistory`

---

## Section 9: LOW — API Client Edge Cases

### FE-024 | `post`/`patch` always `JSON.stringify` body

- **Severity**: LOW
- **File**: `src/lib/api/client.ts:60-72`
- **Impact**: If someone calls `apiClient.post(url, formData)` instead of `apiClient.upload()`, FormData gets stringified to `"[object FormData]"`. Latent bug.

**Fix**: Add FormData detection in `post` and `patch`:

```typescript
// AFTER
async post<T>(endpoint: string, body: unknown): Promise<T> {
  return this.request<T>(endpoint, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
    ...(body instanceof FormData ? { headers: {} } : {}),
  });
}

async patch<T>(endpoint: string, body: unknown): Promise<T> {
  return this.request<T>(endpoint, {
    method: 'PATCH',
    body: body instanceof FormData ? body : JSON.stringify(body),
    ...(body instanceof FormData ? { headers: {} } : {}),
  });
}
```

- [ ] Add FormData guard to `post` and `patch`

---

### FE-025 | Server error messages propagated directly to user

- **Severity**: LOW
- **File**: `src/lib/api/client.ts:40`
- **Impact**: If the backend ever returns internal details (e.g., database errors), they would be shown in toast notifications.

```typescript
// BEFORE
throw new Error(errorBody.error?.message || `Request failed: ${response.statusText}`);

// Recommendation: No code change required if backend properly sanitizes.
// Document as a defense-in-depth concern — backend MUST sanitize error messages.
```

- [ ] Verify backend sanitizes all error messages (no code change needed here)

---

## Tracking Checklist

### Critical (fix first)
- [x] **FE-001**: ~~snake_case -> camelCase types~~ — **No fix needed.** Backend verified: frontend types correctly match API responses. The inconsistency is backend-side (raw Prisma vs manual transforms).
- [x] **FE-002**: RouteGuard + use-auth.ts `UserRole[]` typing
- [x] **FE-003**: Consolidate `User` type to `auth.types.ts`
- [x] **FE-004**: Resolved with FE-003
- [x] **FE-005**: `ROLE_LABELS` and `getReadinessLabel` strict typing + `Person.role` → `UserRole`

### Medium (fix next)
- [x] **FE-006**: `useUpdateProfile` cache invalidation
- [x] **FE-007**: `useUploadAvatar` cache invalidation
- [x] **FE-008**: `useChangePassword` cache invalidation
- [x] **FE-009**: Add `LOGOUT` to 401 exception list
- [x] **FE-010**: Convert 7 `mutate` -> `mutateAsync` + try/catch
- [x] **FE-011**: Add `defaultValues` to 5 forms
- [x] **FE-012**: Add `isSubmitting` to 4+ submit buttons
- [x] **FE-013**: Replace 6 hardcoded routes with `ROUTES` constants + `buildRoute()` helper

### Low (fix when convenient)
- [x] **FE-014**: URLSearchParams in 4 hooks
- [x] **FE-015**: Type re-exports in 12 hooks
- [x] **FE-016**: Extract columns outside 2 components
- [ ] **FE-017**: Add PageLoader to 3 pages — deferred (pages are static placeholders)
- [ ] **FE-018**: Move 4 inline styles to CSS classes — deferred (cosmetic only)
- [x] **FE-019**: Add prop interfaces to 3 components
- [x] **FE-020**: Remove 3 dead endpoints (`REGISTER`, `REFRESH`, `HEALTH`)
- [x] **FE-021**: Consolidate duplicate endpoint aliases (documented with HTTP method comments)
- [x] **FE-022**: `process.env.NODE_ENV` -> `import.meta.env.DEV`
- [x] **FE-023**: Align `CheckInHistory` with `PaginatedResponse` (`pageSize` → `limit`)
- [x] **FE-024**: FormData guard in `post`/`patch`
- [x] **FE-025**: Verify backend error sanitization — no code change needed
