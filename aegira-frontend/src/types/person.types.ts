import type { UserRole } from '@/types/auth.types';

export interface Person {
  id: string;
  company_id: string;
  email: string;
  first_name: string;
  last_name: string;
  gender: 'MALE' | 'FEMALE' | null;
  date_of_birth: string | null; // ISO date "YYYY-MM-DD"
  profile_picture_url: string | null;
  contact_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  role: UserRole;
  team_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Worker schedule override (optional, uses team schedule if null)
  work_days?: string | null; // CSV: "0,1,2,3,4,5,6"
  check_in_start?: string | null; // HH:mm format
  check_in_end?: string | null; // HH:mm format
  team?: {
    id: string;
    name: string;
    check_in_start: string;
    check_in_end: string;
    work_days: string;
  };
  // Effective next-day transfer (pending)
  effective_team_id?: string | null;
  effective_transfer_date?: string | null; // ISO date string
  transfer_initiated_by?: string | null;
  effective_team?: {
    id: string;
    name: string;
    check_in_start: string;
    check_in_end: string;
    work_days: string;
  } | null;
}

export interface PersonStats {
  personId: string;
  checkInStreak: number;
  avgReadiness: number;
  totalCheckIns: number;
  lastCheckIn?: string;
  weeklyCompletion: number;
}

export interface CreatePersonData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  gender?: 'MALE' | 'FEMALE';
  dateOfBirth?: string;
  role?: UserRole;
  teamId?: string;
  // Worker schedule override (optional)
  workDays?: string;
  checkInStart?: string;
  checkInEnd?: string;
  contactNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
}

export interface UpdatePersonData {
  firstName?: string;
  lastName?: string;
  gender?: 'MALE' | 'FEMALE' | null;
  dateOfBirth?: string | null;
  role?: UserRole;
  teamId?: string | null;
  isActive?: boolean;
  // Worker schedule override (optional, null clears override)
  workDays?: string | null;
  checkInStart?: string | null;
  checkInEnd?: string | null;
  contactNumber?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
}
