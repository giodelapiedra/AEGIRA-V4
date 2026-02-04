export const ROUTES = {
  // Public routes
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  UNAUTHORIZED: '/unauthorized',

  // Common routes (all authenticated users)
  DASHBOARD: '/dashboard',
  NOTIFICATIONS: '/notifications',
  SETTINGS: '/settings',

  // Worker routes
  CHECK_IN: '/check-in',
  CHECK_IN_HISTORY: '/check-in/history',
  MY_SCHEDULE: '/schedule',

  // Incident routes (all authenticated users)
  MY_INCIDENTS: '/my-incidents',
  REPORT_INCIDENT: '/report-incident',
  INCIDENT_DETAIL: '/incidents/:id',

  // Team Leader / Supervisor routes
  TEAM: '/team',
  TEAM_DETAIL: '/team/:teamId',
  TEAM_DASHBOARD: '/team-dashboard',
  TEAM_MISSED_CHECKINS: '/team/missed-check-ins',
  TEAM_ANALYTICS: '/team/analytics',
  TEAM_MEMBERS: '/team/members',
  TEAM_CHECK_IN_HISTORY: '/team/check-in-history',
  TEAM_REPORTS: '/team/reports',
  TEAM_WORKER_DETAIL: '/team/workers/:workerId',

  // Admin routes
  ADMIN_TEAMS: '/admin/teams',
  ADMIN_TEAMS_CREATE: '/admin/teams/create',
  ADMIN_TEAMS_EDIT: '/admin/teams/:teamId/edit',
  ADMIN_WORKERS: '/admin/workers',
  ADMIN_WORKERS_CREATE: '/admin/workers/create',
  ADMIN_WORKERS_EDIT: '/admin/workers/:workerId/edit',
  ADMIN_SCHEDULES: '/admin/schedules',
  ADMIN_HOLIDAYS: '/admin/holidays',
  ADMIN_SETTINGS: '/admin/settings',
  ADMIN_INCIDENTS: '/admin/incidents',
  ADMIN_INCIDENT_DETAIL: '/admin/incidents/:id',
  ADMIN_CASES: '/admin/cases',
  ADMIN_CASE_DETAIL: '/admin/cases/:id',
  ADMIN_AUDIT_LOGS: '/admin/audit-logs',
  ADMIN_SYSTEM_HEALTH: '/admin/system-health',

  // Person management (admin)
  PERSON: '/person',
  PERSON_DETAIL: '/person/:personId',

} as const;
