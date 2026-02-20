import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { RouteGuard } from './RouteGuard';
import { GuestGuard } from './GuestGuard';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ROUTES } from '@/config/routes.config';

// Lazy load pages
const LoginPage = lazy(() =>
  import('@/features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const SignupPage = lazy(() =>
  import('@/features/auth/pages/SignupPage').then((m) => ({ default: m.SignupPage }))
);
const UnauthorizedPage = lazy(() =>
  import('@/features/auth/pages/UnauthorizedPage').then((m) => ({ default: m.UnauthorizedPage }))
);
const SettingsPage = lazy(() =>
  import('@/features/auth/pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const Dashboard = lazy(() =>
  import('@/features/dashboard/pages/Dashboard').then((m) => ({ default: m.Dashboard }))
);
const TeamLeadDashboard = lazy(() =>
  import('@/features/dashboard/pages/TeamLeaderDashboard').then((m) => ({
    default: m.TeamLeadDashboard,
  }))
);
const CheckInPage = lazy(() =>
  import('@/features/check-in/pages/CheckInPage').then((m) => ({ default: m.CheckInPage }))
);
const CheckInHistoryPage = lazy(() =>
  import('@/features/check-in/pages/CheckInHistoryPage').then((m) => ({
    default: m.CheckInHistoryPage,
  }))
);
const TeamsPage = lazy(() =>
  import('@/features/team/pages/TeamsPage').then((m) => ({ default: m.TeamsPage }))
);
const TeamDetailPage = lazy(() =>
  import('@/features/team/pages/TeamDetailPage').then((m) => ({ default: m.TeamDetailPage }))
);
const NotificationsPage = lazy(() =>
  import('@/features/notifications/pages/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  }))
);
const PersonsPage = lazy(() =>
  import('@/features/person/pages/PersonsPage').then((m) => ({ default: m.PersonsPage }))
);
const PersonDetailPage = lazy(() =>
  import('@/features/person/pages/PersonDetailPage').then((m) => ({
    default: m.PersonDetailPage,
  }))
);

// Team Leader / Supervisor pages
const MissedCheckInsPage = lazy(() =>
  import('@/features/team/pages/MissedCheckInsPage').then((m) => ({
    default: m.MissedCheckInsPage,
  }))
);
const TeamAnalyticsPage = lazy(() =>
  import('@/features/team/pages/TeamAnalyticsPage').then((m) => ({
    default: m.TeamAnalyticsPage,
  }))
);
const TeamMembersPage = lazy(() =>
  import('@/features/team/pages/TeamMembersPage').then((m) => ({
    default: m.TeamMembersPage,
  }))
);
const TeamCheckInHistoryPage = lazy(() =>
  import('@/features/team/pages/TeamCheckInHistoryPage').then((m) => ({
    default: m.TeamCheckInHistoryPage,
  }))
);
const TeamWorkerDetailPage = lazy(() =>
  import('@/features/team/pages/TeamWorkerDetailPage').then((m) => ({
    default: m.TeamWorkerDetailPage,
  }))
);
const TeamReportsPage = lazy(() =>
  import('@/features/team/pages/TeamReportsPage').then((m) => ({
    default: m.TeamReportsPage,
  }))
);

// Admin pages
const AdminTeamsPage = lazy(() =>
  import('@/features/admin/pages/AdminTeamsPage').then((m) => ({
    default: m.AdminTeamsPage,
  }))
);
const AdminWorkersPage = lazy(() =>
  import('@/features/admin/pages/AdminWorkersPage').then((m) => ({
    default: m.AdminWorkersPage,
  }))
);
const AdminHolidaysPage = lazy(() =>
  import('@/features/admin/pages/AdminHolidaysPage').then((m) => ({
    default: m.AdminHolidaysPage,
  }))
);
const AdminAuditLogsPage = lazy(() =>
  import('@/features/admin/pages/AdminAuditLogsPage').then((m) => ({
    default: m.AdminAuditLogsPage,
  }))
);
const AdminCompanySettingsPage = lazy(() =>
  import('@/features/admin/pages/AdminCompanySettingsPage').then((m) => ({
    default: m.AdminCompanySettingsPage,
  }))
);
const AdminWorkerCreatePage = lazy(() =>
  import('@/features/admin/pages/AdminWorkerCreatePage').then((m) => ({
    default: m.AdminWorkerCreatePage,
  }))
);
const AdminWorkerEditPage = lazy(() =>
  import('@/features/admin/pages/AdminWorkerEditPage').then((m) => ({
    default: m.AdminWorkerEditPage,
  }))
);
const AdminTeamCreatePage = lazy(() =>
  import('@/features/admin/pages/AdminTeamCreatePage').then((m) => ({
    default: m.AdminTeamCreatePage,
  }))
);
const AdminTeamEditPage = lazy(() =>
  import('@/features/admin/pages/AdminTeamEditPage').then((m) => ({
    default: m.AdminTeamEditPage,
  }))
);

// WHS pages
const WhsWorkersPage = lazy(() =>
  import('@/features/dashboard/pages/WhsWorkersPage').then((m) => ({
    default: m.WhsWorkersPage,
  }))
);
const WhsAnalyticsPage = lazy(() =>
  import('@/features/dashboard/pages/WhsAnalyticsPage').then((m) => ({
    default: m.WhsAnalyticsPage,
  }))
);

// Incident pages
const ReportIncidentPage = lazy(() =>
  import('@/features/incident/pages/ReportIncidentPage').then((m) => ({
    default: m.ReportIncidentPage,
  }))
);
const MyIncidentsPage = lazy(() =>
  import('@/features/incident/pages/MyIncidentsPage').then((m) => ({
    default: m.MyIncidentsPage,
  }))
);
const IncidentDetailPage = lazy(() =>
  import('@/features/incident/pages/IncidentDetailPage').then((m) => ({
    default: m.IncidentDetailPage,
  }))
);
const AdminIncidentsPage = lazy(() =>
  import('@/features/incident/pages/AdminIncidentsPage').then((m) => ({
    default: m.AdminIncidentsPage,
  }))
);
const AdminCasesPage = lazy(() =>
  import('@/features/incident/pages/AdminCasesPage').then((m) => ({
    default: m.AdminCasesPage,
  }))
);
const CaseDetailPage = lazy(() =>
  import('@/features/incident/pages/CaseDetailPage').then((m) => ({
    default: m.CaseDetailPage,
  }))
);

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
        {/* Guest-only routes — redirect to dashboard if already authenticated */}
        <Route path={ROUTES.LOGIN} element={<GuestGuard><LoginPage /></GuestGuard>} />
        <Route path={ROUTES.SIGNUP} element={<GuestGuard><SignupPage /></GuestGuard>} />
        <Route path={ROUTES.UNAUTHORIZED} element={<UnauthorizedPage />} />

        {/* Protected routes - All authenticated users */}
        <Route
          element={
            <RouteGuard>
              <AppLayout />
            </RouteGuard>
          }
        >
          {/* Common routes - all authenticated users */}
          <Route path={ROUTES.HOME} element={<Navigate to={ROUTES.DASHBOARD} replace />} />
          <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
          <Route path={ROUTES.NOTIFICATIONS} element={<NotificationsPage />} />
          <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />

          {/* Incident routes — all authenticated users */}
          <Route path={ROUTES.MY_INCIDENTS} element={<MyIncidentsPage />} />
          <Route path={ROUTES.REPORT_INCIDENT} element={<ReportIncidentPage />} />
          <Route path={ROUTES.INCIDENT_DETAIL} element={<IncidentDetailPage />} />

          {/* ============================================ */}
          {/* WORKER ONLY ROUTES                          */}
          {/* Only workers can submit check-ins           */}
          {/* ============================================ */}
          <Route element={<RouteGuard allowedRoles={['WORKER']} />}>
            <Route path={ROUTES.CHECK_IN} element={<CheckInPage />} />
            <Route path={ROUTES.CHECK_IN_HISTORY} element={<CheckInHistoryPage />} />
          </Route>

          {/* ============================================ */}
          {/* TEAM LEAD & SUPERVISOR ROUTES               */}
          {/* Both roles can view their team's data       */}
          {/* ============================================ */}
          <Route element={<RouteGuard allowedRoles={['TEAM_LEAD', 'SUPERVISOR']} />}>
            <Route path={ROUTES.TEAM_MISSED_CHECKINS} element={<MissedCheckInsPage />} />
            <Route path={ROUTES.TEAM_ANALYTICS} element={<TeamAnalyticsPage />} />
            <Route path={ROUTES.TEAM_MEMBERS} element={<TeamMembersPage />} />
            <Route path={ROUTES.TEAM_CHECK_IN_HISTORY} element={<TeamCheckInHistoryPage />} />
          </Route>

          {/* Worker Profile - viewable by team management + WHS */}
          <Route element={<RouteGuard allowedRoles={['TEAM_LEAD', 'SUPERVISOR', 'WHS']} />}>
            <Route path={ROUTES.TEAM_WORKER_DETAIL} element={<TeamWorkerDetailPage />} />
          </Route>

          {/* ============================================ */}
          {/* SUPERVISOR ONLY ROUTES                      */}
          {/* Multi-team oversight and reporting          */}
          {/* ============================================ */}
          <Route element={<RouteGuard allowedRoles={['SUPERVISOR']} />}>
            <Route path={ROUTES.TEAM} element={<TeamsPage />} />
            <Route path={ROUTES.TEAM_DETAIL} element={<TeamDetailPage />} />
            <Route path={ROUTES.TEAM_DASHBOARD} element={<TeamLeadDashboard />} />
            <Route path={ROUTES.TEAM_REPORTS} element={<TeamReportsPage />} />
          </Route>

          {/* ============================================ */}
          {/* WHS ONLY ROUTES                             */}
          {/* Incidents, cases, workers, analytics        */}
          {/* ============================================ */}
          <Route element={<RouteGuard allowedRoles={['WHS']} />}>
            <Route path={ROUTES.WHS_INCIDENTS} element={<AdminIncidentsPage />} />
            <Route path={ROUTES.WHS_INCIDENT_DETAIL} element={<IncidentDetailPage />} />
            <Route path={ROUTES.WHS_CASES} element={<AdminCasesPage />} />
            <Route path={ROUTES.WHS_CASE_DETAIL} element={<CaseDetailPage />} />
            <Route path={ROUTES.WHS_WORKERS} element={<WhsWorkersPage />} />
            <Route path={ROUTES.WHS_ANALYTICS} element={<WhsAnalyticsPage />} />
          </Route>

          {/* ============================================ */}
          {/* ADMIN ONLY: Person management               */}
          {/* ============================================ */}
          <Route element={<RouteGuard allowedRoles={['ADMIN']} />}>
            <Route path={ROUTES.PERSON} element={<PersonsPage />} />
            <Route path={ROUTES.PERSON_DETAIL} element={<PersonDetailPage />} />
          </Route>

          {/* ============================================ */}
          {/* ADMIN ONLY ROUTES                           */}
          {/* Full system administration access           */}
          {/* ============================================ */}
          <Route element={<RouteGuard allowedRoles={['ADMIN']} />}>
            {/* Team Administration */}
            <Route path={ROUTES.ADMIN_TEAMS} element={<AdminTeamsPage />} />
            <Route path={ROUTES.ADMIN_TEAMS_CREATE} element={<AdminTeamCreatePage />} />
            <Route path={ROUTES.ADMIN_TEAMS_EDIT} element={<AdminTeamEditPage />} />

            {/* Worker Administration */}
            <Route path={ROUTES.ADMIN_WORKERS} element={<AdminWorkersPage />} />
            <Route path={ROUTES.ADMIN_WORKERS_CREATE} element={<AdminWorkerCreatePage />} />
            <Route path={ROUTES.ADMIN_WORKERS_EDIT} element={<AdminWorkerEditPage />} />

            {/* Holiday Management */}
            <Route path={ROUTES.ADMIN_HOLIDAYS} element={<AdminHolidaysPage />} />

            {/* System Administration */}
            <Route path={ROUTES.ADMIN_AUDIT_LOGS} element={<AdminAuditLogsPage />} />
            <Route path={ROUTES.ADMIN_SETTINGS} element={<AdminCompanySettingsPage />} />
          </Route>
        </Route>

        {/* Catch all - redirect to dashboard */}
        <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      </Routes>
    </Suspense>
  );
}
