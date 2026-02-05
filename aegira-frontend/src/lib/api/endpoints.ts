/**
 * API Endpoints - Must match backend routes
 * Backend: src/modules/{feature}/{feature}.routes.ts
 */
export const ENDPOINTS = {
  // Auth Module
  AUTH: {
    LOGIN: '/auth/login',
    SIGNUP: '/auth/signup',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
    CHANGE_PASSWORD: '/auth/change-password',
    VERIFY_PASSWORD: '/auth/verify-password',
  },

  // Check-in Module
  CHECK_IN: {
    SUBMIT: '/check-ins',
    TODAY: '/check-ins/today',
    STATUS: '/check-ins/status',
    HISTORY: '/check-ins/history',
    BY_ID: (id: string) => `/check-ins/${id}`,
    BY_PERSON: (personId: string) => `/check-ins/person/${personId}`,
  },

  // Dashboard Module
  DASHBOARD: {
    WORKER: '/dashboard/worker',
    TEAM_LEAD: '/dashboard/team-lead',
    SUPERVISOR: '/dashboard/supervisor',
    ADMIN: '/dashboard/admin',
    WHS: '/dashboard/whs',
    WHS_ANALYTICS: '/dashboard/whs-analytics',
  },

  // Team Module
  TEAM: {
    LIST: '/teams',
    CREATE: '/teams',
    DETAIL: (id: string) => `/teams/${id}`,      // GET (detailed view)
    BY_ID: (id: string) => `/teams/${id}`,        // GET (alias of DETAIL)
    UPDATE: (id: string) => `/teams/${id}`,       // PATCH
    DELETE: (id: string) => `/teams/${id}`,       // DELETE
    MEMBERS: (id: string) => `/teams/${id}/members`,  // GET / POST
    MEMBER: (teamId: string, personId: string) => `/teams/${teamId}/members/${personId}`, // DELETE
    SCHEDULE: (id: string) => `/teams/${id}/schedule`,
  },

  // Person Module
  PERSON: {
    LIST: '/persons',
    CREATE: '/persons',
    ME: '/persons/me',
    UPDATE_PROFILE: '/persons/me',
    UPLOAD_AVATAR: '/persons/me/avatar',
    BY_ID: (id: string) => `/persons/${id}`,
    UPDATE: (id: string) => `/persons/${id}`,
    CHECK_INS: (id: string) => `/persons/${id}/check-ins`,
    STATS: (id: string) => `/persons/${id}/stats`,
  },

  // Notification Module
  NOTIFICATIONS: {
    LIST: '/notifications',
    UNREAD_COUNT: '/notifications/unread',
    BY_ID: (id: string) => `/notifications/${id}`,
    MARK_READ: (id: string) => `/notifications/${id}/read`,
    MARK_ALL_READ: '/notifications/mark-all-read',
  },

  // Admin Module
  ADMIN: {
    COMPANY_SETTINGS: '/admin/company/settings',
    HOLIDAYS: '/admin/holidays',
    HOLIDAY_BY_ID: (id: string) => `/admin/holidays/${id}`,
    AUDIT_LOGS: '/admin/audit-logs',
    SYSTEM_HEALTH: '/admin/system/health',
  },

  // Incident Module
  INCIDENT: {
    CREATE: '/incidents',
    LIST: '/incidents',
    MY: '/incidents/my',
    BY_ID: (id: string) => `/incidents/${id}`,
    TIMELINE: (id: string) => `/incidents/${id}/timeline`,
    APPROVE: (id: string) => `/incidents/${id}/approve`,
    REJECT: (id: string) => `/incidents/${id}/reject`,
  },

  // Case Module
  CASE: {
    LIST: '/cases',
    BY_ID: (id: string) => `/cases/${id}`,
    UPDATE: (id: string) => `/cases/${id}`,
  },

  // Team Management (extended)
  TEAM_MANAGEMENT: {
    MISSED_CHECK_INS: '/teams/missed-check-ins',
    UPDATE_MISSED_CHECK_IN: (id: string) => `/teams/missed-check-ins/${id}`,
    ANALYTICS: '/teams/analytics',
    MY_MEMBERS: '/teams/my-members',
    CHECK_IN_HISTORY: '/teams/check-in-history',
  },
} as const;
