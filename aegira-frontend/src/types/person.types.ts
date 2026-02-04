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
  role: UserRole;
  team_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  team?: {
    id: string;
    name: string;
  };
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
}

export interface UpdatePersonData {
  firstName?: string;
  lastName?: string;
  gender?: 'MALE' | 'FEMALE' | null;
  dateOfBirth?: string | null;
  role?: UserRole;
  teamId?: string | null;
  isActive?: boolean;
}
