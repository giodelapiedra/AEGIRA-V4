// Admin Module Validators
import { z } from 'zod';

export const createHolidaySchema = z.object({
  name: z.string().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recurring: z.boolean().optional().default(false),
  is_recurring: z.boolean().optional(), // Alias for recurring
});

export const updateHolidaySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  recurring: z.boolean().optional(),
  is_recurring: z.boolean().optional(), // Alias for recurring
});

export const updateSettingsSchema = z.object({
  companyName: z.string().min(1).max(100).optional(),
  timezone: z.string().optional(),
  checkInWindowStart: z.string().optional(),
  checkInWindowEnd: z.string().optional(),
  reminderTime: z.string().optional(),
  checkInDataRetentionDays: z.number().min(30).max(730).optional(),
  auditLogRetentionDays: z.number().min(30).max(365).optional(),
});

export const rejectAmendmentSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required').max(500),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(['WORKER', 'TEAM_LEAD', 'SUPERVISOR', 'ADMIN'], {
    errorMap: () => ({ message: 'Role must be WORKER, TEAM_LEAD, SUPERVISOR, or ADMIN' }),
  }),
});

export type CreateHolidayData = z.infer<typeof createHolidaySchema>;
export type UpdateHolidayData = z.infer<typeof updateHolidaySchema>;
export type UpdateSettingsData = z.infer<typeof updateSettingsSchema>;
export type RejectAmendmentData = z.infer<typeof rejectAmendmentSchema>;
export type UpdateUserRoleData = z.infer<typeof updateUserRoleSchema>;
