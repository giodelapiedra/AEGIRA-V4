// Team Validation Schemas
// Note: Cross-midnight check-in windows (e.g., 22:00→06:00) are intentionally NOT supported.
// The validator enforces checkInEnd > checkInStart (same-day windows only).
import { z } from 'zod';
import { TIME_REGEX, WORK_DAYS_REGEX, isEndTimeAfterStart } from '../../shared/schedule.utils';

export const createTeamSchema = z
  .object({
    name: z.string().min(1).max(100).trim(),
    description: z.string().max(500).optional(),
    leaderId: z.string().uuid('Team leader is required'), // Team leader (TEAM_LEAD role) - REQUIRED
    supervisorId: z.string().uuid().optional().nullable(), // Supervisor (optional)
    // Check-in schedule
    checkInStart: z.string().regex(TIME_REGEX, 'Invalid time format (HH:MM)').optional(),
    checkInEnd: z.string().regex(TIME_REGEX, 'Invalid time format (HH:MM)').optional(),
    workDays: z.string().regex(WORK_DAYS_REGEX, 'Invalid work days format').optional(),
  })
  .refine(
    (data) => {
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

export const updateTeamSchema = z
  .object({
    name: z.string().min(1).max(100).trim().optional(),
    description: z.string().max(500).optional(),
    leaderId: z.string().uuid().optional(), // Can change leader but cannot remove
    supervisorId: z.string().uuid().optional().nullable(), // Can assign/change/remove supervisor
    isActive: z.boolean().optional(),
    // Check-in schedule
    checkInStart: z.string().regex(TIME_REGEX, 'Invalid time format (HH:MM)').optional(),
    checkInEnd: z.string().regex(TIME_REGEX, 'Invalid time format (HH:MM)').optional(),
    workDays: z.string().regex(WORK_DAYS_REGEX, 'Invalid work days format').optional(),
  })
  .refine(
    (data) => {
      // Both checkInStart and checkInEnd must be provided together to prevent inverted windows
      const hasStart = data.checkInStart !== undefined;
      const hasEnd = data.checkInEnd !== undefined;
      if (hasStart !== hasEnd) return false;
      return true;
    },
    {
      message: 'Both checkInStart and checkInEnd must be set together',
      path: ['checkInStart'],
    }
  )
  .refine(
    (data) => {
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

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
