import { z } from 'zod';

export const getCasesQuerySchema = z.object({
  status: z.enum(['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  search: z.string().optional(),
});

export type GetCasesQuery = z.infer<typeof getCasesQuerySchema>;

export const updateCaseSchema = z.object({
  status: z.enum(['INVESTIGATING', 'RESOLVED', 'CLOSED']).optional(),
  notes: z.string().max(2000).trim().optional(),
});

export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
