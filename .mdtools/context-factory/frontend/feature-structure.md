---
description: Frontend Feature Module Structure
globs: ["aegira-frontend/src/features/**/*"]
alwaysApply: false
---
# Frontend Feature Structure

Every frontend feature is a self-contained module under `src/features/`.

## Canonical Layout

```
src/features/<feature-name>/
├── components/        # Feature-specific UI components
├── hooks/             # React Query hooks for this feature
├── pages/             # Route pages for this feature
└── types/             # Feature-specific types (optional)
```

## Full Frontend Directory Structure

```
aegira-frontend/src/
├── config/                # Configuration files (API, routes, query)
├── lib/
│   ├── api/               # API client, endpoints, types
│   ├── utils/             # Utility functions
│   └── hooks/             # Shared custom hooks
├── types/                 # Shared TypeScript types
├── stores/                # Zustand stores (auth, UI state)
├── features/              # Feature modules
│   ├── auth/              # Login, signup, auth flow
│   ├── person/            # Worker profiles
│   ├── team/              # Team management UI
│   ├── check-in/          # Daily check-in form & submission
│   ├── dashboard/         # Analytics views
│   ├── admin/             # Admin panel
│   ├── notifications/     # Notification center
│   └── schedule/          # Schedule management
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── layout/            # Layout components (AppLayout, Sidebar, Header)
│   └── common/            # Reusable components (PageHeader, LoadingSpinner)
├── routes/                # Route definitions and guards
└── styles/                # Global styles
```

## Existing Shared Components (USE THESE, DON'T RECREATE)

```
components/ui/data-table.tsx       → DataTable + SortableHeader
components/ui/table.tsx            → Table, TableHeader, TableBody
components/ui/card.tsx             → Card, CardHeader, CardTitle, CardContent
components/ui/badge.tsx            → Badge (success, destructive, warning, info, outline)
components/ui/button.tsx           → Button (default, outline, ghost, destructive)
components/ui/tabs.tsx             → Tabs, TabsList, TabsTrigger, TabsContent
components/ui/avatar.tsx           → Avatar, AvatarImage, AvatarFallback
components/ui/separator.tsx        → Separator
components/ui/progress.tsx         → Progress
components/ui/dialog.tsx           → Dialog (modals)
components/ui/sheet.tsx            → Sheet (side panels)
components/ui/skeleton.tsx         → Skeleton (loading placeholders)
components/common/PageHeader.tsx   → PageHeader (title + description + action)
components/common/PageLoader.tsx   → PageLoader (full page loading skeleton)
components/common/LoadingSpinner.tsx → LoadingSpinner
components/common/ErrorMessage.tsx → ErrorMessage
components/common/EmptyState.tsx   → EmptyState (icon + title + description)
components/common/ConfirmDialog.tsx → ConfirmDialog (confirm/cancel modals)
```

## Rules

- One feature folder per domain
- Feature folders contain ONLY feature-specific code
- Shared hooks go in `lib/hooks/`
- Shared components go in `components/common/` or `components/ui/`
- NEVER import from one feature into another (use shared/ instead)
- API calls: `apiClient` + `ENDPOINTS` constants (dynamic endpoints are functions: `ENDPOINTS.PERSON.BY_ID(id)`)
- Query hooks: `useQuery` + `STALE_TIMES` (REALTIME 30s, STANDARD 2m, STATIC 10m, IMMUTABLE 30m)
- Mutations: `useMutation` + invalidate ALL affected query keys in `onSuccess`
- Pages: wrap in `<PageLoader isLoading error skeleton="type">` — never manual if/else
- Tables: `DataTable` from `@/components/ui/data-table` — never custom pagination
- Forms: React Hook Form + Zod (`zodResolver`) — never manual useState for form fields
- State: TanStack Query (server), Zustand (auth only), React Hook Form (forms)
- Page index: 0-indexed in frontend (`pageIndex`), 1-indexed in API (`page`)
- Types: import from `@/types/`, re-export from hooks
