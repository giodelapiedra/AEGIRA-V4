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
  companyName: z.string().min(1).max(100).trim().optional(),
  timezone: z.string().min(1).optional(),
  industry: z.string().optional(),
  businessRegistrationType: z.string().optional(),
  businessRegistrationNumber: z.string().optional(),
  businessType: z.string().optional(),
  addressStreet: z.string().max(200).optional(),
  addressCity: z.string().max(100).optional(),
  addressPostalCode: z.string().max(20).optional(),
  addressState: z.string().max(100).optional(),
  addressCountry: z.string().max(10).optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(['WORKER', 'TEAM_LEAD', 'SUPERVISOR', 'WHS', 'ADMIN'], {
    errorMap: () => ({ message: 'Role must be WORKER, TEAM_LEAD, SUPERVISOR, WHS, or ADMIN' }),
  }),
});

export type CreateHolidayData = z.infer<typeof createHolidaySchema>;
export type UpdateHolidayData = z.infer<typeof updateHolidaySchema>;
export type UpdateSettingsData = z.infer<typeof updateSettingsSchema>;
export type UpdateUserRoleData = z.infer<typeof updateUserRoleSchema>;
