import { z } from 'zod';

export const createIncidentSchema = z.object({
  incidentType: z.enum([
    'PHYSICAL_INJURY',
    'ILLNESS_SICKNESS',
    'MENTAL_HEALTH',
    'MEDICAL_EMERGENCY',
    'HEALTH_SAFETY_CONCERN',
    'OTHER',
  ]),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  title: z.string().min(1, 'Title is required').max(200).trim(),
  location: z.string().max(200).trim().optional(),
  description: z.string().min(1, 'Description is required').max(2000).trim(),
});

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;

export const getIncidentsQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  type: z
    .enum([
      'PHYSICAL_INJURY',
      'ILLNESS_SICKNESS',
      'MENTAL_HEALTH',
      'MEDICAL_EMERGENCY',
      'HEALTH_SAFETY_CONCERN',
      'OTHER',
    ])
    .optional(),
  search: z.string().optional(),
});

export type GetIncidentsQuery = z.infer<typeof getIncidentsQuerySchema>;

export const getMyIncidentsQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

export type GetMyIncidentsQuery = z.infer<typeof getMyIncidentsQuerySchema>;

export const rejectIncidentSchema = z.object({
  rejectionReason: z.enum([
    'DUPLICATE_REPORT',
    'INSUFFICIENT_INFORMATION',
    'NOT_WORKPLACE_INCIDENT',
    'OTHER',
  ]),
  rejectionExplanation: z
    .string()
    .min(1, 'Explanation is required')
    .max(500)
    .trim(),
});

export type RejectIncidentInput = z.infer<typeof rejectIncidentSchema>;
