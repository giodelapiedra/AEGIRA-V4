// Check-In Validation Schemas
import { z } from 'zod';

export const submitCheckInSchema = z.object({
  hoursSlept: z.number().min(0).max(15),
  sleepQuality: z.number().int().min(1).max(10),
  stressLevel: z.number().int().min(1).max(10),
  physicalCondition: z.number().int().min(1).max(10),
  painLevel: z.number().int().min(0).max(10).optional(),
  painLocation: z.string().max(100).optional(),
  physicalConditionNotes: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
}).refine(
  (data) => {
    if (data.painLevel && data.painLevel > 0 && !data.painLocation?.trim()) {
      return false;
    }
    return true;
  },
  {
    message: 'Pain location is required when pain level is above 0',
    path: ['painLocation'],
  }
);

export const getCheckInHistorySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type SubmitCheckInInput = z.infer<typeof submitCheckInSchema>;
