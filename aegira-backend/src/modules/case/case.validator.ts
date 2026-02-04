import { z } from 'zod';

export const getCasesQuerySchema = z.object({
  status: z.enum(['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED']).optional(),
  search: z.string().optional(),
});

export type GetCasesQuery = z.infer<typeof getCasesQuerySchema>;

export const updateCaseSchema = z.object({
  status: z.enum(['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED']).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).trim().optional(),
});

export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
