/**
 * Check-in Types - Must match backend Prisma schema
 * Backend: prisma/schema.prisma -> CheckIn model
 */

// Form submission data
export interface CheckInSubmission {
  sleepHours: number;        // 0-24, decimal
  sleepQuality: number;      // 1-10, integer
  fatigueLevel: number;      // 1-10, integer (1=energized, 10=exhausted)
  stressLevel: number;       // 1-10, integer
  painLevel: number;         // 0-10, integer (0=no pain)
  painLocation?: string;     // Required if painLevel > 0 (dropdown selection)
  physicalConditionNotes?: string; // Free-text physical condition notes
  notes?: string;
}

// Readiness result from backend calculation
export interface ReadinessResult {
  score: number;             // 0-100
  category: ReadinessCategory;
  level?: string;            // Raw level from backend (GREEN, YELLOW, etc.)
  factors?: ReadinessFactor[];
  recommendations?: string[];
}

export type ReadinessCategory =
  | 'ready'           // 80-100: Fully ready for work
  | 'modified_duty'   // 60-79: Can work with modifications
  | 'needs_attention' // 40-59: Requires attention
  | 'not_ready';      // 0-39: Not ready for full duty

export interface ReadinessFactor {
  name: string;
  value: number;
  weight: number;
  impact: 'positive' | 'neutral' | 'negative';
  description?: string;
}

// Raw backend check-in response (snake_case Prisma format)
// Used by useCheckInHistory and useTodayCheckIn hooks
export interface BackendCheckIn {
  id: string;
  company_id: string;
  person_id: string;
  check_in_date: string;
  hours_slept: number;
  sleep_quality: number;
  stress_level: number;
  physical_condition: number;
  pain_level: number | null;
  pain_location: string | null;
  physical_condition_notes: string | null;
  notes?: string;
  readiness_score: number;
  readiness_level: string;
  sleep_score: number;
  stress_score: number;
  physical_score: number;
  pain_score: number | null;
  created_at: string;
}

// Full check-in record from backend
export interface CheckIn {
  id: string;
  personId: string;
  companyId: string;
  checkInDate: string;       // ISO date string

  // Input fields
  sleepHours: number;
  sleepQuality: number;
  fatigueLevel: number;
  stressLevel: number;
  painLevel: number;
  painLocation?: string;
  physicalConditionNotes?: string;
  notes?: string;

  // Calculated results
  readinessResult: ReadinessResult;

  // Metadata
  submittedAt: string;       // ISO datetime string
  createdAt: string;
  updatedAt: string;
}

// Paginated history response (aligned with PaginatedResponse convention)
export interface CheckInHistory {
  items: CheckIn[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Simplified check-in data for dashboard display
export interface DashboardCheckIn {
  id: string;
  sleepHours: number;
  sleepQuality: number;
  fatigueLevel: number;
  stressLevel: number;
  readinessResult: ReadinessResult;
}

// Worker schedule context from team settings
export interface WorkerSchedule {
  isWorkDay: boolean;        // Whether today is a scheduled work day (false on holidays)
  isHoliday: boolean;        // Whether today is a company holiday
  holidayName: string | null; // Name of the holiday if applicable
  isAssignedToday: boolean;  // Worker was just assigned today (not required to check-in)
  windowOpen: boolean;       // Check-in window is currently open
  windowClosed: boolean;     // Check-in window has already closed
  checkInStart: string;      // e.g. "06:00"
  checkInEnd: string;        // e.g. "10:00"
}

// Worker dashboard stats
export interface WorkerDashboardStats {
  streak: number;            // Consecutive check-in days
  avgReadiness: number;      // Average readiness score since assignment
  completionRate: number;    // % of required check-ins completed (work days since assignment)
  completedDays: number;     // Number of days with check-ins this week
  requiredDays: number;      // Number of required work days this week
  todayCheckIn: DashboardCheckIn | null;
  weeklyTrend: {
    date: string;
    score: number;
    category: ReadinessCategory;
  }[];
  memberSince: string | null; // ISO date when worker was assigned to team
  schedule: WorkerSchedule;   // Today's schedule context
}

// Team lead dashboard stats (team leads monitor their assigned team)
// teamId/teamName can be null if not assigned to lead a team yet
export interface TeamLeadDashboardStats {
  teamId: string | null;
  teamName: string | null;
  teamSize: number;
  todaySubmissions: number;
  expectedCheckIns: number; // Workers who should check-in today (excludes newly assigned)
  pendingCheckIns: number;
  missedCheckIns: number; // Workers who missed (window closed, no check-in)
  complianceRate: number; // Percentage of expected who submitted
  newlyAssigned: number; // Workers assigned today (not required to check-in)
  teamAvgReadiness: number;
  memberStatuses: TeamMemberStatus[];
}

// Team summary for supervisor view
export interface TeamSummaryStats {
  teamId: string;
  teamName: string;
  leaderId: string | null;
  leaderName: string | null;
  workerCount: number;
  todayCheckIns: number;
  pendingCheckIns: number;
  avgReadiness: number;
  complianceRate: number;
}

// Supervisor dashboard stats (supervisors monitor all teams)
export interface SupervisorDashboardStats {
  totalTeams: number;
  totalWorkers: number;
  totalCheckIns: number;
  totalPending: number;
  overallAvgReadiness: number;
  overallComplianceRate: number;
  teams: TeamSummaryStats[];
}

// Member check-in status for team dashboard
export type MemberCheckInStatus = 'submitted' | 'pending' | 'not_required' | 'missed';

export interface TeamMemberStatus {
  personId: string;
  fullName: string;
  email?: string;
  submitted: boolean;
  status: MemberCheckInStatus; // More detailed status
  assignedToday?: boolean; // True if worker was just assigned today
  checkInTime?: string;
  readinessCategory?: ReadinessCategory;
  readinessScore?: number;
}

// Admin dashboard stats (management-focused, not check-in focused)
export interface AdminDashboardStats {
  totalTeams: number;
  activeTeams: number;
  inactiveTeams: number;
  totalWorkers: number;
  totalTeamLeads: number;
  totalSupervisors: number;
  unassignedWorkers: number;
}
