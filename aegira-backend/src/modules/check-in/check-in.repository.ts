// Check-In Repository - Database Access
import type { PrismaClient, CheckIn } from '@prisma/client';
import { BaseRepository } from '../../shared/base.repository';
import { calculateSkip, paginate } from '../../shared/utils';
import type { PaginationParams, PaginatedResponse } from '../../types/api.types';

export class CheckInRepository extends BaseRepository {
  constructor(prisma: PrismaClient, companyId: string) {
    super(prisma, companyId);
  }

  async findById(id: string): Promise<CheckIn | null> {
    return this.prisma.checkIn.findFirst({
      where: this.where({ id }),
      include: {
        person: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        event: {
          select: {
            is_late: true,
            late_by_minutes: true,
            event_time: true,
          },
        },
      },
    });
  }

  async findByDate(personId: string, date: Date): Promise<CheckIn | null> {
    return this.prisma.checkIn.findFirst({
      where: this.where({
        person_id: personId,
        check_in_date: date,
      }),
      include: {
        event: {
          select: {
            is_late: true,
            late_by_minutes: true,
            event_time: true,
          },
        },
      },
    });
  }

  /**
   * Lightweight existence check — only returns id, no relations.
   * Use when you only need to know if a check-in exists (e.g., status check).
   */
  async existsForDate(personId: string, date: Date): Promise<boolean> {
    const result = await this.prisma.checkIn.findFirst({
      where: this.where({ person_id: personId, check_in_date: date }),
      select: { id: true },
    });
    return !!result;
  }

  async findByPerson(
    personId: string,
    params: PaginationParams
  ): Promise<PaginatedResponse<CheckIn>> {
    const where = this.where({ person_id: personId });

    const [items, total] = await Promise.all([
      this.prisma.checkIn.findMany({
        where,
        skip: calculateSkip(params),
        take: params.limit,
        orderBy: { check_in_date: 'desc' },
        select: {
          id: true,
          company_id: true,
          person_id: true,
          event_id: true,
          check_in_date: true,
          hours_slept: true,
          sleep_quality: true,
          stress_level: true,
          physical_condition: true,
          pain_level: true,
          pain_location: true,
          physical_condition_notes: true,
          notes: true,
          readiness_score: true,
          readiness_level: true,
          sleep_score: true,
          stress_score: true,
          physical_score: true,
          pain_score: true,
          created_at: true,
          event: {
            select: {
              is_late: true,
              late_by_minutes: true,
              event_time: true,
            },
          },
        },
      }),
      this.prisma.checkIn.count({ where }),
    ]);

    return paginate(items, total, params);
  }

  /**
   * Get person with their team schedule.
   * Filters by is_active to prevent deactivated workers from submitting check-ins.
   * Returns null if person is inactive — callers must guard against this.
   */
  async getPersonWithTeam(personId: string) {
    return this.prisma.person.findFirst({
      where: {
        id: personId,
        company_id: this.companyId,
        is_active: true,
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            check_in_start: true,
            check_in_end: true,
            work_days: true,
            is_active: true,
          },
        },
      },
    });
  }

  /**
   * Find check-ins with person information and team filtering
   * Used by team management endpoints to get check-in history
   */
  async findCheckInsWithPerson(
    params: PaginationParams,
    filters: {
      teamIds?: string[] | null;
      personId?: string;
      search?: string;
    }
  ) {
    // Build person filter (team + search)
    const personConditions: Record<string, unknown>[] = [];
    if (filters.teamIds) {
      personConditions.push({ team_id: { in: filters.teamIds } });
    }
    if (filters.search) {
      personConditions.push({
        OR: [
          { first_name: { startsWith: filters.search, mode: 'insensitive' } },
          { last_name: { startsWith: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
        ],
      });
    }

    const workerFilter = filters.personId ? { person_id: filters.personId } : {};
    const hasPersonFilter = personConditions.length > 0;

    const where = this.where({
      ...(hasPersonFilter ? { person: { AND: personConditions } } : {}),
      ...workerFilter,
    });

    const [items, total] = await Promise.all([
      this.prisma.checkIn.findMany({
        where,
        select: {
          id: true,
          person_id: true,
          event_id: true,
          check_in_date: true,
          hours_slept: true,
          sleep_quality: true,
          stress_level: true,
          physical_condition: true,
          pain_level: true,
          pain_location: true,
          physical_condition_notes: true,
          notes: true,
          readiness_score: true,
          readiness_level: true,
          sleep_score: true,
          stress_score: true,
          physical_score: true,
          pain_score: true,
          created_at: true,
          event: {
            select: {
              is_late: true,
              late_by_minutes: true,
              event_time: true,
            },
          },
          person: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
        orderBy: { check_in_date: 'desc' },
        skip: calculateSkip(params),
        take: params.limit,
      }),
      this.prisma.checkIn.count({ where }),
    ]);

    return paginate(items, total, params);
  }
}
