import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type { CompanySettings, UpdateCompanySettingsData } from '@/types/company.types';

// Re-export types for convenience
export type { CompanySettings, UpdateCompanySettingsData };

/**
 * Fetch company settings
 */
export function useCompanySettings() {
  return useQuery({
    queryKey: ['admin', 'company-settings'],
    staleTime: STALE_TIMES.STATIC,
    queryFn: () => apiClient.get<CompanySettings>(ENDPOINTS.ADMIN.COMPANY_SETTINGS),
  });
}

/**
 * Update company settings
 */
export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateCompanySettingsData) =>
      apiClient.patch<CompanySettings>(ENDPOINTS.ADMIN.COMPANY_SETTINGS, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'company-settings'] });
    },
  });
}
