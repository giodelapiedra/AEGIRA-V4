// Person Validation Schemas
import { z } from 'zod';
import { TIME_REGEX, WORK_DAYS_REGEX, isEndTimeAfterStart } from '../../shared/schedule.utils';

export const createPersonSchema = z
  .object({
    email: z.string().email().toLowerCase().trim(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    firstName: z.string().min(1).max(100).trim(),
    lastName: z.string().min(1).max(100).trim(),
    gender: z.enum(['MALE', 'FEMALE']).optional(),
    dateOfBirth: z.string().optional(), // ISO date string "YYYY-MM-DD"
    teamId: z.string().uuid().optional(),
    role: z.enum(['ADMIN', 'WHS', 'SUPERVISOR', 'TEAM_LEAD', 'WORKER']).default('WORKER'),
    // Worker schedule override (optional)
    workDays: z.string().regex(WORK_DAYS_REGEX, 'Invalid work days format (e.g., "1,3,5")').optional(),
    checkInStart: z.string().regex(TIME_REGEX, 'Invalid time format (HH:MM)').optional(),
    checkInEnd: z.string().regex(TIME_REGEX, 'Invalid time format (HH:MM)').optional(),
    // Contact information (optional)
    contactNumber: z.string().max(20).trim().optional(),
    emergencyContactName: z.string().max(100).trim().optional(),
    emergencyContactPhone: z.string().max(20).trim().optional(),
    emergencyContactRelationship: z.string().max(50).trim().optional(),
  })
  .refine(
    (data) => {
      // If checkInStart is set, checkInEnd must also be set (and vice versa)
      if (data.checkInStart && !data.checkInEnd) return false;
      if (data.checkInEnd && !data.checkInStart) return false;
      return true;
    },
    {
      message: 'Both checkInStart and checkInEnd must be set together',
      path: ['checkInStart'],
    }
  )
  .refine(
    (data) => {
      // Validate end time is after start time
      if (data.checkInStart && data.checkInEnd) {
        return isEndTimeAfterStart(data.checkInStart, data.checkInEnd);
      }
      return true;
    },
    {
      message: 'Check-in end time must be after start time',
      path: ['checkInEnd'],
    }
  );

export const updatePersonSchema = z
  .object({
    firstName: z.string().min(1).max(100).trim().optional(),
    lastName: z.string().min(1).max(100).trim().optional(),
    role: z.enum(['ADMIN', 'WHS', 'SUPERVISOR', 'TEAM_LEAD', 'WORKER']).optional(),
    gender: z.enum(['MALE', 'FEMALE']).nullable().optional(),
    dateOfBirth: z.string().nullable().optional(),
    teamId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
    // Worker schedule override (optional, nullable to clear)
    workDays: z.string().regex(WORK_DAYS_REGEX, 'Invalid work days format (e.g., "1,3,5")').nullable().optional(),
    checkInStart: z.string().regex(TIME_REGEX, 'Invalid time format (HH:MM)').nullable().optional(),
    checkInEnd: z.string().regex(TIME_REGEX, 'Invalid time format (HH:MM)').nullable().optional(),
    // Contact information (optional, nullable to clear)
    contactNumber: z.string().max(20).trim().nullable().optional(),
    emergencyContactName: z.string().max(100).trim().nullable().optional(),
    emergencyContactPhone: z.string().max(20).trim().nullable().optional(),
    emergencyContactRelationship: z.string().max(50).trim().nullable().optional(),
  })
  .refine(
    (data) => {
      // If checkInStart is set (not null), checkInEnd must also be set
      // If one is null (clearing), both should be null
      if (data.checkInStart !== undefined && data.checkInEnd !== undefined) {
        // Both defined - check if they're both set or both null
        if ((data.checkInStart === null) !== (data.checkInEnd === null)) {
          return false;
        }
        // If both are strings, they're both set - OK
        // If both are null, they're both cleared - OK
        return true;
      }
      // If only one is being updated
      if (data.checkInStart !== undefined && data.checkInEnd === undefined) {
        // Setting start without end is not allowed (unless null to clear)
        return data.checkInStart === null;
      }
      if (data.checkInEnd !== undefined && data.checkInStart === undefined) {
        // Setting end without start is not allowed (unless null to clear)
        return data.checkInEnd === null;
      }
      return true;
    },
    {
      message: 'Both checkInStart and checkInEnd must be set together (or both cleared with null)',
      path: ['checkInStart'],
    }
  )
  .refine(
    (data) => {
      // Validate end time is after start time (only when both are strings, not null)
      if (
        typeof data.checkInStart === 'string' &&
        typeof data.checkInEnd === 'string'
      ) {
        return isEndTimeAfterStart(data.checkInStart, data.checkInEnd);
      }
      return true;
    },
    {
      message: 'Check-in end time must be after start time',
      path: ['checkInEnd'],
    }
  );

// Schema for users updating their own profile (limited fields)
export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName: z.string().min(1).max(100).trim().optional(),
  gender: z.enum(['MALE', 'FEMALE']).nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  contactNumber: z.string().max(20).trim().nullable().optional(),
  emergencyContactName: z.string().max(100).trim().nullable().optional(),
  emergencyContactPhone: z.string().max(20).trim().nullable().optional(),
  emergencyContactRelationship: z.string().max(50).trim().nullable().optional(),
});

export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
