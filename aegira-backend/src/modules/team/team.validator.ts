// Team Validation Schemas
import { z } from 'zod';

// Time format validation (HH:MM)
const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

// Work days validation (CSV of 0-6)
const workDaysRegex = /^[0-6](,[0-6])*$/;

export const createTeamSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  leaderId: z.string().uuid('Team leader is required'), // Team leader (TEAM_LEAD role) - REQUIRED
  supervisorId: z.string().uuid().optional().nullable(), // Supervisor (optional)
  // Check-in schedule
  checkInStart: z.string().regex(timeRegex, 'Invalid time format (HH:MM)').optional(),
  checkInEnd: z.string().regex(timeRegex, 'Invalid time format (HH:MM)').optional(),
  workDays: z.string().regex(workDaysRegex, 'Invalid work days format').optional(),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).optional(),
  leaderId: z.string().uuid().optional(), // Can change leader but cannot remove
  supervisorId: z.string().uuid().optional().nullable(), // Can assign/change/remove supervisor
  isActive: z.boolean().optional(),
  // Check-in schedule
  checkInStart: z.string().regex(timeRegex, 'Invalid time format (HH:MM)').optional(),
  checkInEnd: z.string().regex(timeRegex, 'Invalid time format (HH:MM)').optional(),
  workDays: z.string().regex(workDaysRegex, 'Invalid work days format').optional(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
