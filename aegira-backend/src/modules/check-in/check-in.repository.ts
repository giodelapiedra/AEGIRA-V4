// Check-In Repository - Database Access
import type { PrismaClient, CheckIn, Prisma } from '@prisma/client';
import { BaseRepository } from '../../shared/base.repository';
import { calculateSkip, paginate } from '../../shared/utils';
import type { PaginationParams, PaginatedResponse } from '../../types/api.types';
import type { ReadinessLevel } from '../../types/domain.types';

export interface CreateCheckInData {
  personId: string;
  eventId: string;
  checkInDate: Date;
  hoursSlept: number;
  sleepQuality: number;
  stressLevel: number;
  physicalCondition: number;
  painLevel?: number;
  painLocation?: string;
  physicalConditionNotes?: string;
  notes?: string;
  readinessScore: number;
  readinessLevel: ReadinessLevel;
  sleepScore: number;
  stressScore: number;
  physicalScore: number;
  painScore?: number | null;
}

export class CheckInRepository extends BaseRepository {
  constructor(prisma: PrismaClient, companyId: string) {
    super(prisma, companyId);
  }

  async create(data: CreateCheckInData): Promise<CheckIn> {
    return this.prisma.checkIn.create({
      data: {
        company_id: this.companyId,
        person_id: data.personId,
        event_id: data.eventId,
        check_in_date: data.checkInDate,
        hours_slept: data.hoursSlept,
        sleep_quality: data.sleepQuality,
        stress_level: data.stressLevel,
        physical_condition: data.physicalCondition,
        pain_level: data.painLevel ?? null,
        pain_location: data.painLocation ?? null,
        physical_condition_notes: data.physicalConditionNotes ?? null,
        notes: data.notes,
        readiness_score: data.readinessScore,
        readiness_level: data.readinessLevel,
        sleep_score: data.sleepScore,
        stress_score: data.stressScore,
        physical_score: data.physicalScore,
        pain_score: data.painScore ?? null,
      },
      include: {
        person: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });
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
      },
    });
  }

  async findByDate(personId: string, date: Date): Promise<CheckIn | null> {
    return this.prisma.checkIn.findFirst({
      where: this.where({
        person_id: personId,
        check_in_date: date,
      }),
    });
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
      }),
      this.prisma.checkIn.count({ where }),
    ]);

    return paginate(items, total, params);
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    params: PaginationParams
  ): Promise<PaginatedResponse<CheckIn>> {
    const where: Prisma.CheckInWhereInput = {
      company_id: this.companyId,
      check_in_date: {
        gte: startDate,
        lte: endDate,
      },
    };

    const [items, total] = await Promise.all([
      this.prisma.checkIn.findMany({
        where,
        skip: calculateSkip(params),
        take: params.limit,
        orderBy: { check_in_date: 'desc' },
        include: {
          person: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              team_id: true,
            },
          },
        },
      }),
      this.prisma.checkIn.count({ where }),
    ]);

    return paginate(items, total, params);
  }

  async countByDateAndLevel(
    date: Date,
    level?: ReadinessLevel
  ): Promise<number> {
    return this.prisma.checkIn.count({
      where: this.where({
        check_in_date: date,
        ...(level && { readiness_level: level }),
      }),
    });
  }

  async getAverageReadiness(date: Date): Promise<number> {
    const result = await this.prisma.checkIn.aggregate({
      where: this.where({ check_in_date: date }),
      _avg: {
        readiness_score: true,
      },
    });

    return result._avg.readiness_score ?? 0;
  }

  /**
   * Get person with their team schedule
   */
  async getPersonWithTeam(personId: string) {
    return this.prisma.person.findFirst({
      where: {
        id: personId,
        company_id: this.companyId,
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
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.checkIn.count({ where }),
    ]);

    return { items, total, params };
  }
}
