// MissedCheckIn Validation Schemas
import { z } from 'zod';

export const getMissedCheckInsQuerySchema = z.object({
  workerId: z.string().optional(),
});

export type GetMissedCheckInsQuery = z.infer<typeof getMissedCheckInsQuerySchema>;
