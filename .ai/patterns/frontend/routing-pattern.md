# Routing Pattern
> React Router v6 with route guards, lazy loading, and buildRoute helpers

## When to Use
- Adding new pages to the application
- Setting up route protection by role
- Navigating between pages programmatically
- Building dynamic route paths with parameters

## Canonical Implementation

### Route Configuration (ROUTES Constants)

All route paths are defined as constants in `config/routes.config.ts`.

```typescript
// config/routes.config.ts
export const ROUTES = {
  // Public routes
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  UNAUTHORIZED: '/unauthorized',

  // Common routes (all authenticated users)
  DASHBOARD: '/dashboard',
  NOTIFICATIONS: '/notifications',

  // Dynamic routes with :param placeholders
  TEAM_DETAIL: '/team/:teamId',
  TEAM_WORKER_DETAIL: '/team/workers/:workerId',
  INCIDENT_DETAIL: '/incidents/:id',
  PERSON_DETAIL: '/person/:personId',

  // Admin routes
  ADMIN_TEAMS: '/admin/teams',
  ADMIN_TEAMS_CREATE: '/admin/teams/create',
  ADMIN_TEAMS_EDIT: '/admin/teams/:teamId/edit',
  ADMIN_WORKERS: '/admin/workers',
  ADMIN_WORKERS_CREATE: '/admin/workers/create',
  ADMIN_WORKERS_EDIT: '/admin/workers/:workerId/edit',
} as const;
```

### Lazy Loading Pages

All page components are lazy-loaded with `React.lazy` and wrapped in `Suspense`.

```typescript
// routes/index.tsx
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { RouteGuard } from './RouteGuard';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ROUTES } from '@/config/routes.config';

// Lazy load all pages — use .then() for named exports
const LoginPage = lazy(() =>
  import('@/features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const Dashboard = lazy(() =>
  import('@/features/dashboard/pages/Dashboard').then((m) => ({ default: m.Dashboard }))
);
const TeamsPage = lazy(() =>
  import('@/features/team/pages/TeamsPage').then((m) => ({ default: m.TeamsPage }))
);
const AdminWorkersPage = lazy(() =>
  import('@/features/admin/pages/AdminWorkersPage').then((m) => ({
    default: m.AdminWorkersPage,
  }))
);
// ... more lazy imports

// Suspense fallback for initial chunk load
function PageLoader() {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes — no guard */}
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />

        {/* Protected routes — all authenticated users */}
        <Route
          element={
            <RouteGuard>
              <AppLayout />
            </RouteGuard>
          }
        >
          <Route path={ROUTES.HOME} element={<Navigate to={ROUTES.DASHBOARD} replace />} />
          <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />

          {/* Role-restricted routes */}
          <Route element={<RouteGuard allowedRoles={['WORKER']} />}>
            <Route path={ROUTES.CHECK_IN} element={<CheckInPage />} />
          </Route>

          <Route element={<RouteGuard allowedRoles={['TEAM_LEAD', 'SUPERVISOR']} />}>
            <Route path={ROUTES.TEAM_MEMBERS} element={<TeamMembersPage />} />
          </Route>

          <Route element={<RouteGuard allowedRoles={['ADMIN']} />}>
            <Route path={ROUTES.ADMIN_TEAMS} element={<AdminTeamsPage />} />
            <Route path={ROUTES.ADMIN_WORKERS} element={<AdminWorkersPage />} />
            <Route path={ROUTES.ADMIN_WORKERS_CREATE} element={<AdminWorkerCreatePage />} />
            <Route path={ROUTES.ADMIN_WORKERS_EDIT} element={<AdminWorkerEditPage />} />
          </Route>

          <Route element={<RouteGuard allowedRoles={['ADMIN', 'WHS']} />}>
            <Route path={ROUTES.ADMIN_INCIDENTS} element={<AdminIncidentsPage />} />
          </Route>
        </Route>

        {/* Catch-all → redirect to dashboard */}
        <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      </Routes>
    </Suspense>
  );
}
```

### Route Guard (Auth + Role Protection)

```typescript
// routes/RouteGuard.tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '@/features/auth/hooks/useSession';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ROUTES } from '@/config/routes.config';
import type { UserRole } from '@/types/auth.types';

interface RouteGuardProps {
  children?: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function RouteGuard({ children, allowedRoles }: RouteGuardProps) {
  const { data, isLoading, isError } = useSession();
  const location = useLocation();

  // Wait for session check
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // No valid session — redirect to login (preserve intended destination)
  if (isError || !data?.user) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  // Check role-based access
  if (allowedRoles && !allowedRoles.includes(data.user.role)) {
    return <Navigate to={ROUTES.UNAUTHORIZED} replace />;
  }

  // Layout route: render Outlet; wrapper route: render children
  return children ? <>{children}</> : <Outlet />;
}
```

### buildRoute Utility (Dynamic Paths)

```typescript
// lib/utils/route.utils.ts
export function buildRoute(route: string, params: Record<string, string>): string {
  return Object.entries(params).reduce(
    (path, [key, value]) => path.replace(`:${key}`, encodeURIComponent(value)),
    route
  );
}
```

Usage:
```typescript
import { buildRoute } from '@/lib/utils/route.utils';
import { ROUTES } from '@/config/routes.config';

// Build dynamic routes
buildRoute(ROUTES.TEAM_DETAIL, { teamId: 'abc-123' });
// → '/team/abc-123'

buildRoute(ROUTES.ADMIN_WORKERS_EDIT, { workerId: 'xyz-456' });
// → '/admin/workers/xyz-456/edit'

buildRoute(ROUTES.PERSON_DETAIL, { personId: 'def-789' });
// → '/person/def-789'
```

### Navigation in Components

```typescript
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes.config';
import { buildRoute } from '@/lib/utils/route.utils';

export function TeamsPage() {
  const navigate = useNavigate();

  // Static route navigation
  const goToCreateTeam = () => navigate(ROUTES.ADMIN_TEAMS_CREATE);

  // Dynamic route navigation
  const goToTeamDetail = (teamId: string) => {
    navigate(buildRoute(ROUTES.TEAM_DETAIL, { teamId }));
  };

  // Go back
  const goBack = () => navigate(-1);

  // Redirect after form submit
  const onSubmit = async (data: FormData) => {
    try {
      await createTeam.mutateAsync(data);
      navigate(ROUTES.ADMIN_TEAMS); // Back to list page
    } catch (error) {
      // handle error
    }
  };
}
```

### Reading Route Parameters

```typescript
import { useParams } from 'react-router-dom';

export function TeamDetailPage() {
  // Read :teamId from URL
  const { teamId } = useParams<{ teamId: string }>();

  // Use in query hook
  const { data: team, isLoading, error } = useTeam(teamId!);

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="detail">
      <div>{team?.name}</div>
    </PageLoader>
  );
}
```

## Route Guard Patterns

### Layout Route Guard (Wraps AppLayout)
```typescript
// All authenticated users — wraps the layout
<Route
  element={
    <RouteGuard>
      <AppLayout />
    </RouteGuard>
  }
>
  <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
</Route>
```

### Nested Role Guard (No children, uses Outlet)
```typescript
// Role-restricted routes — nested inside the layout
<Route element={<RouteGuard allowedRoles={['ADMIN']} />}>
  <Route path={ROUTES.ADMIN_TEAMS} element={<AdminTeamsPage />} />
  <Route path={ROUTES.ADMIN_WORKERS} element={<AdminWorkersPage />} />
</Route>
```

### Multi-Role Guard
```typescript
// Multiple roles can access
<Route element={<RouteGuard allowedRoles={['TEAM_LEAD', 'SUPERVISOR']} />}>
  <Route path={ROUTES.TEAM_MEMBERS} element={<TeamMembersPage />} />
  <Route path={ROUTES.TEAM_MISSED_CHECKINS} element={<MissedCheckInsPage />} />
</Route>
```

## Lazy Import Pattern

Named exports require `.then()` to conform to `React.lazy` expectations.

```typescript
// Named export (most common in this project)
const TeamsPage = lazy(() =>
  import('@/features/team/pages/TeamsPage').then((m) => ({ default: m.TeamsPage }))
);

// Default export (rare)
const SomePage = lazy(() => import('@/features/some/pages/SomePage'));
```

## Rules

### Route Configuration
- ✅ **DO** use `ROUTES` constants from `config/routes.config.ts` (never hardcode paths)
- ✅ **DO** use `buildRoute` for dynamic paths with parameters
- ✅ **DO** add new routes to the `ROUTES` constant first, then reference them
- ❌ **NEVER** hardcode route paths in `navigate()` calls: `navigate('/teams/abc-123')`
- ❌ **NEVER** hardcode route paths in `<Route path="">`: always use `ROUTES.X`
- ❌ **NEVER** use string concatenation for dynamic routes: `` navigate(`/teams/${id}`) ``

### Route Protection
- ✅ **DO** use `RouteGuard` for all protected routes
- ✅ **DO** use `allowedRoles` prop for role-restricted routes
- ✅ **DO** nest role guards inside the layout route guard
- ✅ **DO** redirect unauthorized users to `/unauthorized`
- ✅ **DO** redirect unauthenticated users to `/login` with `state={{ from: location }}`
- ❌ **NEVER** allow access to admin pages without a role guard
- ❌ **NEVER** check roles manually inside page components (use RouteGuard)

### Lazy Loading
- ✅ **DO** lazy-load ALL page components with `React.lazy()`
- ✅ **DO** wrap all routes in a single `<Suspense>` with a loading fallback
- ✅ **DO** use `.then((m) => ({ default: m.ComponentName }))` for named exports
- ❌ **NEVER** import page components directly at the top of routes/index.tsx
- ❌ **NEVER** skip the Suspense wrapper (causes crash on slow networks)

### Navigation
- ✅ **DO** use `useNavigate()` hook for programmatic navigation
- ✅ **DO** use `navigate(-1)` for "back" buttons
- ✅ **DO** navigate to list page after successful form submission
- ❌ **NEVER** use `window.location.href` for in-app navigation (breaks SPA)
- ❌ **NEVER** use `<a href="">` for in-app links (use `<Link>` or `navigate()`)

## Common Mistakes

### WRONG: Hardcoded route paths
```typescript
// WRONG - hardcoded paths throughout the app
navigate('/teams');
navigate(`/teams/${teamId}`);
navigate('/admin/workers/create');

<Route path="/admin/teams" element={<AdminTeamsPage />} />
```

### CORRECT: ROUTES constants + buildRoute
```typescript
// CORRECT - centralized constants
navigate(ROUTES.ADMIN_TEAMS);
navigate(buildRoute(ROUTES.TEAM_DETAIL, { teamId }));
navigate(ROUTES.ADMIN_WORKERS_CREATE);

<Route path={ROUTES.ADMIN_TEAMS} element={<AdminTeamsPage />} />
```

### WRONG: String concatenation for dynamic routes
```typescript
// WRONG - manual string concatenation
const goToTeam = (id: string) => {
  navigate(`/team/${id}`);           // WRONG
};

const goToEdit = (id: string) => {
  navigate(`/admin/workers/${id}/edit`);  // WRONG
};
```

### CORRECT: buildRoute utility
```typescript
// CORRECT - buildRoute handles encoding
const goToTeam = (id: string) => {
  navigate(buildRoute(ROUTES.TEAM_DETAIL, { teamId: id }));
};

const goToEdit = (id: string) => {
  navigate(buildRoute(ROUTES.ADMIN_WORKERS_EDIT, { workerId: id }));
};
```

### WRONG: Direct page imports (no lazy loading)
```typescript
// WRONG - all pages loaded upfront
import { TeamsPage } from '@/features/team/pages/TeamsPage';
import { AdminWorkersPage } from '@/features/admin/pages/AdminWorkersPage';
import { DashboardPage } from '@/features/dashboard/pages/Dashboard';

export function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.ADMIN_TEAMS} element={<TeamsPage />} />
    </Routes>
  );
}
```

### CORRECT: Lazy-loaded pages with Suspense
```typescript
// CORRECT - lazy loaded
const TeamsPage = lazy(() =>
  import('@/features/team/pages/TeamsPage').then((m) => ({ default: m.TeamsPage }))
);
const AdminWorkersPage = lazy(() =>
  import('@/features/admin/pages/AdminWorkersPage').then((m) => ({
    default: m.AdminWorkersPage,
  }))
);

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path={ROUTES.ADMIN_TEAMS} element={<TeamsPage />} />
      </Routes>
    </Suspense>
  );
}
```

### WRONG: Missing role guard on admin routes
```typescript
// WRONG - no role protection
<Route path={ROUTES.ADMIN_TEAMS} element={<AdminTeamsPage />} />
<Route path={ROUTES.ADMIN_WORKERS} element={<AdminWorkersPage />} />
```

### CORRECT: RouteGuard with allowedRoles
```typescript
// CORRECT - role-protected
<Route element={<RouteGuard allowedRoles={['ADMIN']} />}>
  <Route path={ROUTES.ADMIN_TEAMS} element={<AdminTeamsPage />} />
  <Route path={ROUTES.ADMIN_WORKERS} element={<AdminWorkersPage />} />
</Route>
```

### WRONG: Checking roles inside page components
```typescript
export function AdminTeamsPage() {
  const user = useAuthStore((s) => s.user);

  // WRONG - role check inside page (should be at route level)
  if (user?.role !== 'ADMIN') {
    return <Navigate to={ROUTES.UNAUTHORIZED} />;
  }

  return <div>{/* admin content */}</div>;
}
```

### CORRECT: Role check at route level via RouteGuard
```typescript
// Route level — RouteGuard handles the check
<Route element={<RouteGuard allowedRoles={['ADMIN']} />}>
  <Route path={ROUTES.ADMIN_TEAMS} element={<AdminTeamsPage />} />
</Route>

// Page component — no role check needed
export function AdminTeamsPage() {
  // Can assume user is ADMIN because RouteGuard already verified
  return <div>{/* admin content */}</div>;
}
```
