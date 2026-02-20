export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  companyCode?: string;
}

// Must match backend Prisma enum: Role (ADMIN, WHS, SUPERVISOR, TEAM_LEAD, WORKER)
export type UserRole = 'WORKER' | 'TEAM_LEAD' | 'SUPERVISOR' | 'WHS' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE' | null;
  dateOfBirth: string | null;
  profilePictureUrl: string | null;
  contactNumber: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  role: UserRole;
  companyId: string;
  companyName: string;
  companyTimezone: string;
}

export interface AuthResponse {
  user: User;
}
