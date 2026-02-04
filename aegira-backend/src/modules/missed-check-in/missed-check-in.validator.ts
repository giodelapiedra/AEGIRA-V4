// MissedCheckIn Validation Schemas
import { z } from 'zod';

export const getMissedCheckInsQuerySchema = z.object({
  status: z.enum(['OPEN', 'INVESTIGATING', 'EXCUSED', 'RESOLVED']).optional(),
  workerId: z.string().optional(),
});

export type GetMissedCheckInsQuery = z.infer<typeof getMissedCheckInsQuerySchema>;

export const updateMissedCheckInSchema = z.object({
  status: z.enum(['INVESTIGATING', 'EXCUSED', 'RESOLVED']),
  notes: z.string().max(500).optional(),
});

export type UpdateMissedCheckInInput = z.infer<typeof updateMissedCheckInSchema>;
