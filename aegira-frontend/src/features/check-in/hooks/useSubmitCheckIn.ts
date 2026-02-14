import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { CheckInSubmission, CheckIn } from '@/types/check-in.types';

export type { CheckInSubmission, CheckIn } from '@/types/check-in.types';

// Transform frontend form data to backend API format
function transformToBackendFormat(data: CheckInSubmission) {
  // energyLevel (1=low, 10=high) maps directly to physicalCondition (1=poor, 10=excellent)
  return {
    hoursSlept: data.sleepHours,
    sleepQuality: data.sleepQuality,
    stressLevel: data.stressLevel,
    physicalCondition: data.energyLevel,
    painLevel: data.painLevel,
    painLocation: data.painLevel > 0 ? data.painLocation : undefined,
    physicalConditionNotes: data.physicalConditionNotes || undefined,
    notes: data.notes || undefined,
  };
}

/**
 * Submit daily check-in mutation
 * POST /api/v1/check-ins
 *
 * Backend handler: check-in.controller.ts -> submitCheckIn
 * Business logic: check-in.service.ts -> submit
 */
export function useSubmitCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CheckInSubmission) =>
      apiClient.post<CheckIn>(ENDPOINTS.CHECK_IN.SUBMIT, transformToBackendFormat(data)),

    onSuccess: () => {
      // Invalidate related queries after successful submission
      queryClient.invalidateQueries({ queryKey: ['check-ins'] }); // ✅ FIX: Invalidates all check-in queries
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['team', 'check-in-history'] }); // ✅ FIX: Team views
      queryClient.invalidateQueries({ queryKey: ['worker-check-ins'] }); // ✅ FIX: Worker detail views
    },
  });
}
