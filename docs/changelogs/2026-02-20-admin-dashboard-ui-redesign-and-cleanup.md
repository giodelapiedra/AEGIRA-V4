# 2026-02-20: Admin Dashboard UI Redesign, Notifications Redesign, Auth Tightening, and Lint Cleanup

## Context

Based on `docs/audits/code review.md`, the admin dashboard and related pages were redesigned for clarity, consistency, and scalability. In the same pass, notification components received a full redesign, WHS-only access was tightened for incident/case detail routes, and lint issues were cleaned up.

Scope:
- Frontend UI/UX redesign (admin dashboard, admin list pages, notifications)
- Frontend behavior additions (notification date grouping, optimistic mark-as-read)
- Backend access control tightening (ADMIN removed from case/incident detail view)
- Lint and type cleanup
- Route consolidation

---

## Summary of Work

### 1) Design System and Visual Foundation

**File:** `aegira-frontend/src/styles/globals.css`

Implemented a more centralized visual system:
- Refined color tokens (`background`, `foreground`, `primary`, `muted`, `border`, etc.) with updated HSL values
- Updated base radius (`0.75rem` to `0.875rem`) and added typography variables (`--font-sans`, `--font-display`)
- Added `antialiased` text rendering and `font-family` on body
- Added heading font-family override (`h1`, `h2`, `h3` use `--font-display`)
- Added ambient background treatment (subtle radial gradients on body)
- Refined dot pattern opacity and size (`32px` to `28px`)
- Added reusable layout utilities via `@layer components`:
  - `.content-shell` (max-width + padding)
  - `.section-stack` (vertical spacing)
  - `.section-description` (muted description text)
  - `.dashboard-grid-4` (responsive 4-column grid)
  - `.dashboard-grid-2` (responsive 2-column grid)

---

### 2) Layout Shell Standardization (Sidebar/Header/Main)

**Files:**
- `aegira-frontend/src/components/layout/AppLayout.tsx`
- `aegira-frontend/src/components/layout/Sidebar.tsx`
- `aegira-frontend/src/components/layout/Header.tsx`

Changes:
- Standardized content width/alignment via `.content-shell`
- Improved desktop sidebar width, spacing, and active/hover states
- Improved mobile bottom nav clarity and visual consistency
- Added stronger header surface treatment (border + blur + consistent container)

---

### 3) Reusable Component Pattern Updates

**Files:**
- `aegira-frontend/src/components/ui/card.tsx`
- `aegira-frontend/src/components/ui/button.tsx`
- `aegira-frontend/src/components/ui/table.tsx`
- `aegira-frontend/src/components/common/PageHeader.tsx`
- `aegira-frontend/src/components/common/EmptyState.tsx`
- `aegira-frontend/src/components/common/LoadingSpinner.tsx`
- `aegira-frontend/src/features/dashboard/components/StatCard.tsx`
- `aegira-frontend/src/components/common/TableSearch.tsx`

Changes:
- Unified card border, corner radius, and elevation behavior
- Standardized button motion/focus/outline behavior
- Standardized table shell and row hover treatment
- Improved page header typography hierarchy
- Improved empty/loading visual states
- Improved stat card icon treatments and visual balance
- Made `TableSearch` responsive (mobile-first stacked layout)

---

### 4) Admin Dashboard Redesign

**File:** `aegira-frontend/src/features/dashboard/pages/AdminDashboard.tsx`

Redesigned with clearer hierarchy:
- Top KPI section (4 stat cards) using `dashboard-grid-4`
- Workforce Overview card (row items with bordered background)
- Quick Actions card expanded from 2 to 4 buttons (Teams, Workers, Holidays, Logs)
- New System Readiness card (Team Activation Rate + Worker Allocation Rate progress bars)
- New Configuration card with Company Settings CTA

Notes:
- Existing data hook (`useAdminDashboardStats`) preserved
- Stats destructured into local variables for cleaner template
- `CardFooter` removed; replaced with inline button layout
- New icons imported: `Calendar`, `FileClock`, `Building2`

---

### 5) Admin List Pages Harmonized

**Files:**
- `aegira-frontend/src/features/admin/pages/AdminTeamsPage.tsx`
- `aegira-frontend/src/features/admin/pages/AdminWorkersPage.tsx`
- `aegira-frontend/src/features/admin/pages/AdminAuditLogsPage.tsx`

Changes:
- Unified page structure using `section-stack` + consistent `PageHeader`
- Added descriptive section copy for better first-time readability
- Standardized list card framing and spacing
- Audit Logs page: unified filter/search toolbar behavior and polish for verification card UI

Notes:
- No API/query logic changes
- Export and filtering behavior preserved

---

### 6) Notifications Redesign

**Files:**
- `aegira-frontend/src/features/notifications/components/NotificationBell.tsx`
- `aegira-frontend/src/features/notifications/components/NotificationItem.tsx`
- `aegira-frontend/src/features/notifications/pages/NotificationsPage.tsx`

#### NotificationBell (`NotificationBell.tsx`)
- Changed trigger from `variant="outline"` to `variant="ghost"` with smaller icon
- Unread indicator changed from animated dot to numeric badge (`9+` cap)
- Dropdown widened (`w-80` to `w-[380px]`) with structured header/content/footer sections
- Added unread count badge in dropdown header
- Added `CheckCheck` icon to "Mark all read" button with `isPending` disabled state
- Empty state enhanced with icon, title, and subtitle
- Notification items now rendered in `divide-y` layout instead of `gap-1`
- New `compact` prop passed to `NotificationItem` in dropdown context
- Added `ArrowRight` icon to "View all" footer link

#### NotificationItem (`NotificationItem.tsx`)
- **Component type changed**: `<Alert>` replaced with `<button>` (improved semantics and click handling)
- Removed `Avatar`/`AvatarFallback` wrapper; icon now rendered in a plain `<div>` with rounded-lg
- Added `compact` prop controlling padding, line-clamp depth, and type label visibility
- Added per-type config: `label` (e.g., "Reminder", "Missed") and `accentColor` (colored left border)
- Unread state now uses colored left border (`border-l-[3px]`) + tinted background instead of background-only
- Unread indicator changed from `AlertCircle` icon to a small primary-colored dot
- Timestamp moved to dedicated row below message
- Color palette shifted from `-100`/`-900/30` to `-50`/`-950/40` for subtler backgrounds

#### NotificationsPage (`NotificationsPage.tsx`)
- **New feature: Date grouping** — notifications grouped into Today / Yesterday / This Week / Earlier using Luxon `DateTime` (new import)
- **New feature: Optimistic mark-as-read** — `optimisticMarkRead()` updates local accumulated ref immediately before server round-trip
- **Bug fix**: Added `isPlaceholderData` guard to prevent cross-tab data leakage when switching between All/Unread/Read tabs
- "Mark all read" extracted to `handleMarkAllRead()` with toast on success and cache clear (`accumulatedRef.current.clear()`)
- Loading skeleton extracted to dedicated `NotificationSkeleton` component matching new card layout
- Tab badges: "All" tab now shows total count via `<Badge>`, "Unread" tab uses `<Badge variant="default">`
- Header description enhanced to show `"X notifications · Y unread"`
- "Read" tab empty state icon changed from `CheckCircle2` to `BellOff`
- Load more button shows `remaining` count (pre-calculated via `Math.max`)
- Card wrapper upgraded to `rounded-xl` with `shadow-sm`
- Date group headers are `sticky top-0` with `backdrop-blur-sm`

---

### 7) Access Control Tightening (Backend)

**Files:**
- `aegira-backend/src/modules/case/case.controller.ts`
- `aegira-backend/src/modules/case/case.routes.ts`
- `aegira-backend/src/modules/incident/incident.controller.ts`

Changes:
- `getCaseById`: ADMIN role removed from bypass — only WHS can view any case; all other roles can only view cases linked to their own incidents
- `getIncidentById`: Same pattern — only WHS can view any incident; others see only their own
- `getIncidentTimeline`: Same pattern applied
- Route comment in `case.routes.ts` updated to reflect "owner of linked incident or WHS" (removed "ADMIN")

Rationale:
- Cases and incidents are WHS-domain entities. ADMIN manages workforce/teams, not safety investigations.
- This tightens the principle of least privilege for the ADMIN role.

---

### 8) Route Consolidation

**File:** `aegira-frontend/src/routes/index.tsx`

Changes:
- Merged two separate `<RouteGuard allowedRoles={['WHS']}>` blocks into one
- Previously: incidents/cases in one guard block, workers/analytics in a duplicate second block
- Now: all four WHS-only route groups under a single `RouteGuard`
- Updated section comment to reflect consolidated scope

---

### 9) Lint and Code Cleanliness Cleanup

**Files:**
- `aegira-frontend/src/index.ts`
- `aegira-frontend/.eslintrc.json`

Changes:
- Replaced `any` in worker env type with explicit interfaces (`AssetsBinding`, `WorkerEnv`)
- Tuned ESLint `react-refresh/only-export-components` config:
  - Added `allowExportNames`: `buttonVariants`, `badgeVariants`, `useToast`, `setGlobalToast`, `toast`
  - Added `overrides` to disable this rule for test files (`src/test/**/*`, `*.test.tsx`)

Outcome:
- `npm run lint` now passes cleanly

---

### 10) Audit Document Updated

**File:** `docs/audits/code review.md`

- Content replaced: previous frontend UI review prompt replaced with a backend performance analysis prompt
- This file serves as a scratch prompt for the next audit pass (backend query performance)

---

## Validation

Executed:
- `npm run lint` (in `aegira-frontend/`)

Result:
- Pass (0 errors, 0 warnings)

## Scope Summary

| Area | Status |
|------|--------|
| Frontend UI/UX (admin dashboard, list pages, components) | Redesigned |
| Frontend notifications (bell, item, page) | Redesigned with new features |
| Backend access control (case/incident detail) | Tightened (ADMIN removed, WHS-only) |
| Frontend routes | Consolidated duplicate WHS guard |
| Lint / type safety | Cleaned |
| Backend business logic (services, repositories, jobs) | Unchanged |
| API endpoints / response shapes | Unchanged |
| Database schema | Unchanged |

## All Files in This Change (26)

**Backend (3):**
1. `aegira-backend/src/modules/case/case.controller.ts`
2. `aegira-backend/src/modules/case/case.routes.ts`
3. `aegira-backend/src/modules/incident/incident.controller.ts`

**Frontend — Design System & Layout (4):**
4. `aegira-frontend/src/styles/globals.css`
5. `aegira-frontend/src/components/layout/AppLayout.tsx`
6. `aegira-frontend/src/components/layout/Sidebar.tsx`
7. `aegira-frontend/src/components/layout/Header.tsx`

**Frontend — Shared Components (8):**
8. `aegira-frontend/src/components/ui/card.tsx`
9. `aegira-frontend/src/components/ui/button.tsx`
10. `aegira-frontend/src/components/ui/table.tsx`
11. `aegira-frontend/src/components/common/PageHeader.tsx`
12. `aegira-frontend/src/components/common/EmptyState.tsx`
13. `aegira-frontend/src/components/common/LoadingSpinner.tsx`
14. `aegira-frontend/src/components/common/TableSearch.tsx`
15. `aegira-frontend/src/features/dashboard/components/StatCard.tsx`

**Frontend — Admin Pages (4):**
16. `aegira-frontend/src/features/dashboard/pages/AdminDashboard.tsx`
17. `aegira-frontend/src/features/admin/pages/AdminTeamsPage.tsx`
18. `aegira-frontend/src/features/admin/pages/AdminWorkersPage.tsx`
19. `aegira-frontend/src/features/admin/pages/AdminAuditLogsPage.tsx`

**Frontend — Notifications (3):**
20. `aegira-frontend/src/features/notifications/components/NotificationBell.tsx`
21. `aegira-frontend/src/features/notifications/components/NotificationItem.tsx`
22. `aegira-frontend/src/features/notifications/pages/NotificationsPage.tsx`

**Frontend — Routing (1):**
23. `aegira-frontend/src/routes/index.tsx`

**Frontend — Lint/Types (2):**
24. `aegira-frontend/src/index.ts`
25. `aegira-frontend/.eslintrc.json`

**Docs (1):**
26. `docs/audits/code review.md`
