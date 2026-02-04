/**
 * Team Types - Must match backend Prisma schema
 * Backend: prisma/schema.prisma -> Team model
 */

export interface TeamLeader {
  id: string;
  first_name: string;
  last_name: string;
}

export interface Team {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  leader_id: string;  // Team leader (TEAM_LEAD role) - Required
  leader?: TeamLeader; // Populated when included in query
  supervisor_id?: string | null;  // Supervisor assigned to this team (optional)
  supervisor?: TeamLeader | null; // Populated when included in query
  // Check-in schedule
  check_in_start: string;  // e.g. "06:00"
  check_in_end: string;    // e.g. "10:00"
  work_days: string;       // CSV: "1,2,3,4,5" (Mon-Fri)
  is_active: boolean;
  created_at: string;
  updated_at: string;
  _count?: {
    members: number;
  };
}

export interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'WORKER' | 'TEAM_LEAD' | 'SUPERVISOR' | 'ADMIN';
  team_id?: string;
  is_active: boolean;
}

export interface CreateTeamData {
  name: string;
  description?: string;
  leaderId: string;  // Required - every team must have a leader
  supervisorId?: string | null;  // Optional supervisor assignment
  checkInStart?: string;
  checkInEnd?: string;
  workDays?: string;
}

export interface UpdateTeamData {
  name?: string;
  description?: string;
  leaderId?: string;  // Can change leader but cannot remove (always required)
  supervisorId?: string | null;  // Can assign/change/remove supervisor
  isActive?: boolean;
  checkInStart?: string;
  checkInEnd?: string;
  workDays?: string;
}

export interface TeamWithMembers extends Team {
  members: TeamMember[];
}

export interface AddTeamMemberData {
  personId: string;
}

// Helper for work days
export const WORK_DAYS_OPTIONS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
] as const;
