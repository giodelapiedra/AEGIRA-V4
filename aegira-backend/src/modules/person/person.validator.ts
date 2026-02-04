// Person Validation Schemas
import { z } from 'zod';

export const createPersonSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  dateOfBirth: z.string().optional(), // ISO date string "YYYY-MM-DD"
  teamId: z.string().uuid().optional(),
  role: z.enum(['ADMIN', 'WHS', 'SUPERVISOR', 'TEAM_LEAD', 'WORKER']).default('WORKER'),
});

export const updatePersonSchema = z.object({
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName: z.string().min(1).max(100).trim().optional(),
  gender: z.enum(['MALE', 'FEMALE']).nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

// Schema for users updating their own profile (limited fields)
export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName: z.string().min(1).max(100).trim().optional(),
  gender: z.enum(['MALE', 'FEMALE']).nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
});

export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
