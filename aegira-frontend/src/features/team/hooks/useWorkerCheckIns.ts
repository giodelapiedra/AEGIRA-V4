import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import { levelToCategory } from '@/lib/utils/format.utils';
import type { CheckIn, CheckInHistory } from '@/types/check-in.types';

export type { CheckIn } from '@/types/check-in.types';

/**
 * Response shape from GET /teams/check-in-history
 * Field types match Prisma schema: CheckIn model
 * Note: This endpoint returns camelCase (transformed by team.controller)
 */
interface TeamCheckInRecord {
  id: string;
  personId: string;
  workerName: string;
  workerEmail: string;
  eventId: string | null;
  checkInDate: string;
  hoursSlept: number;          // Float in Prisma
  sleepQuality: number;        // Int 1-10
  stressLevel: number;         // Int 1-10
  physicalCondition: number;   // Int 1-10
  painLevel: number | null;    // Int? 0-10
  painLocation: string | null;
  physicalConditionNotes: string | null;
  notes: string | null;
  readinessScore: number;      // Int 0-100
  readinessLevel: string;      // Enum: GREEN, YELLOW, RED
  sleepScore: number;          // Int 0-100
  stressScore: number;         // Int 0-100
  physicalScore: number;       // Int 0-100
  painScore: number | null;    // Int? 0-100 (null if no pain reported)
  createdAt: string;
}

interface TeamCheckInResponse {
  items: TeamCheckInRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function transformCheckIn(data: TeamCheckInRecord): CheckIn {
  return {
    id: data.id,
    personId: data.personId,
    companyId: '',
    checkInDate: data.checkInDate.slice(0, 10),
    sleepHours: data.hoursSlept,
    sleepQuality: data.sleepQuality,
    fatigueLevel: 11 - data.physicalCondition,
    stressLevel: data.stressLevel,
    painLevel: data.painLevel ?? 0,
    painLocation: data.painLocation ?? undefined,
    physicalConditionNotes: data.physicalConditionNotes ?? undefined,
    notes: data.notes ?? undefined,
    readinessResult: {
      score: data.readinessScore,
      category: levelToCategory(data.readinessLevel),
      factors: [],
      recommendations: [],
    },
    submittedAt: data.createdAt,
    createdAt: data.createdAt,
    updatedAt: data.createdAt,
  };
}

interface UseWorkerCheckInsParams {
  personId: string;
  page?: number;
  limit?: number;
}

/**
 * Fetch check-in records for a specific worker via /teams/check-in-history
 * Accessible by TEAM_LEAD, SUPERVISOR, and ADMIN roles
 */
export function useWorkerCheckIns({ personId, page = 1, limit = 10 }: UseWorkerCheckInsParams) {
  return useQuery({
    queryKey: ['worker-check-ins', personId, page, limit],
    staleTime: STALE_TIMES.IMMUTABLE,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({
        workerId: personId,
        page: String(page),
        limit: String(limit),
      });

      const data = await apiClient.get<TeamCheckInResponse>(
        `${ENDPOINTS.TEAM_MANAGEMENT.CHECK_IN_HISTORY}?${params.toString()}`
      );

      const transformed: CheckInHistory = {
        items: data.items.map(transformCheckIn),
        total: data.pagination.total,
        page: data.pagination.page,
        limit: data.pagination.limit,
        totalPages: data.pagination.totalPages,
      };

      return transformed;
    },
    enabled: !!personId,
  });
}
