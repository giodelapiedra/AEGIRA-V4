import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type { PaginatedResponse } from '@/types/common.types';
import type { Person } from '@/types/person.types';

/**
 * Fetch active WHS and ADMIN users for case assignment.
 * Returns a flat array (unpaginated, up to 100).
 */
export function useWhsOfficers() {
  return useQuery({
    queryKey: ['persons', 'whs-officers'],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: async () => {
      // Fetch WHS and ADMIN users in parallel
      const [whsRes, adminRes] = await Promise.all([
        apiClient.get<PaginatedResponse<Person>>(
          `${ENDPOINTS.PERSON.LIST}?role=WHS&limit=100`
        ),
        apiClient.get<PaginatedResponse<Person>>(
          `${ENDPOINTS.PERSON.LIST}?role=ADMIN&limit=100`
        ),
      ]);
      // Merge and deduplicate by id
      const map = new Map<string, Person>();
      for (const p of [...whsRes.items, ...adminRes.items]) {
        map.set(p.id, p);
      }
      return Array.from(map.values());
    },
  });
}
