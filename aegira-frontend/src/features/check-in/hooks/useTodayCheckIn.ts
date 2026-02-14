import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import { levelToCategory } from '@/lib/utils/format.utils';
import type { BackendCheckIn, CheckIn, ReadinessFactor } from '@/types/check-in.types';

export type { CheckIn, ReadinessFactor } from '@/types/check-in.types';

// Generate recommendations based on scores (exported for reuse in history transform)
export function generateRecommendations(data: BackendCheckIn): string[] {
  const recommendations: string[] = [];

  if (data.hours_slept < 6) {
    recommendations.push('Consider getting more sleep tonight for better recovery');
  }
  if (data.sleep_quality < 5) {
    recommendations.push('Try to improve sleep quality with better sleep hygiene');
  }
  if (data.stress_level > 7) {
    recommendations.push('High stress detected - consider taking breaks throughout the day');
  }
  if (data.physical_condition < 5) {
    recommendations.push('Physical condition is low - take it easy and stay hydrated');
  }
  if (data.pain_level !== null && data.pain_level >= 5) {
    recommendations.push('Significant pain reported - consider modified duties and report to your team lead');
  }
  if (data.readiness_level === 'RED') {
    recommendations.push('Consider lighter duties today if possible');
  }
  if (recommendations.length === 0) {
    recommendations.push('Great job! You\'re ready for a productive day');
  }

  return recommendations;
}

// Generate factors breakdown (exported for reuse in history transform)
export function generateFactors(data: BackendCheckIn): ReadinessFactor[] {
  const getImpact = (good: boolean, okay: boolean): 'positive' | 'neutral' | 'negative' => {
    if (good) return 'positive';
    if (okay) return 'neutral';
    return 'negative';
  };

  const hasPain = data.pain_level !== null && data.pain_level !== undefined && data.pain_level > 0;

  const sleepScore = data.sleep_score ?? 0;
  const stressScore = data.stress_score ?? 0;
  const physicalScore = data.physical_score ?? 0;

  const factors: ReadinessFactor[] = [
    {
      name: 'Sleep',
      value: sleepScore / 10,
      weight: hasPain ? 0.35 : 0.40,
      impact: getImpact(sleepScore >= 70, sleepScore >= 50),
    },
    {
      name: 'Stress',
      value: stressScore / 10,
      weight: hasPain ? 0.25 : 0.30,
      impact: getImpact(stressScore >= 70, stressScore >= 50),
    },
    {
      name: 'Physical Condition',
      value: physicalScore / 10,
      weight: hasPain ? 0.20 : 0.30,
      impact: getImpact(physicalScore >= 70, physicalScore >= 50),
    },
  ];

  if (hasPain && data.pain_score !== null) {
    factors.push({
      name: 'Pain',
      value: data.pain_score / 10,
      weight: 0.20,
      impact: getImpact(data.pain_score >= 70, data.pain_score >= 50),
    });
  }

  return factors;
}

// Transform backend response to frontend format
function transformCheckIn(data: BackendCheckIn | null): CheckIn | null {
  if (!data) return null;

  return {
    id: data.id,
    personId: data.person_id,
    companyId: data.company_id,
    checkInDate: data.check_in_date.slice(0, 10),
    sleepHours: data.hours_slept,
    sleepQuality: data.sleep_quality,
    energyLevel: data.physical_condition, // Direct mapping: 1=low energy, 10=high energy
    stressLevel: data.stress_level,
    painLevel: data.pain_level ?? 0,
    painLocation: data.pain_location ?? undefined,
    physicalConditionNotes: data.physical_condition_notes ?? undefined,
    notes: data.notes ?? undefined,
    readinessResult: {
      score: data.readiness_score,
      category: levelToCategory(data.readiness_level),
      factors: generateFactors(data),
      recommendations: generateRecommendations(data),
    },
    isLate: data.event?.is_late ?? false,
    lateByMinutes: data.event?.late_by_minutes ?? undefined,
    submittedAt: data.event?.event_time ?? data.created_at,
    createdAt: data.created_at,
    updatedAt: data.created_at,
  };
}

export function useTodayCheckIn() {
  return useQuery({
    queryKey: ['check-ins', 'today'],
    staleTime: STALE_TIMES.STANDARD, // Today's check-in changes when user submits
    queryFn: async () => {
      const data = await apiClient.get<BackendCheckIn | null>(ENDPOINTS.CHECK_IN.TODAY);
      return transformCheckIn(data);
    },
  });
}
