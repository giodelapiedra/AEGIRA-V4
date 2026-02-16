// Team Repository - Database Access
import type { PrismaClient, Team, Prisma } from '@prisma/client';
import { BaseRepository } from '../../shared/base.repository';
import { calculateSkip, paginate } from '../../shared/utils';
import type { PaginationParams, PaginatedResponse } from '../../types/api.types';

export interface CreateTeamData {
  name: string;
  description?: string;
  leaderId: string;  // Required - every team must have a leader
  supervisorId?: string | null;  // Optional supervisor assignment
  checkInStart?: string;
  checkInEnd?: string;
  workDays?: string;
}

export interface UpdateTeamData {
  name?: string;
  description?: string;
  leaderId?: string;  // Can change leader but cannot remove (always required)
  supervisorId?: string | null;  // Can assign/change/remove supervisor
  isActive?: boolean;
  checkInStart?: string;
  checkInEnd?: string;
  workDays?: string;
}

export class TeamRepository extends BaseRepository {
  constructor(prisma: PrismaClient, companyId: string) {
    super(prisma, companyId);
  }

  async create(data: CreateTeamData): Promise<Team> {
    return this.prisma.team.create({
      data: {
        company_id: this.companyId,
        name: data.name,
        description: data.description,
        leader_id: data.leaderId,  // Required
        supervisor_id: data.supervisorId || null,
        check_in_start: data.checkInStart || '06:00',
        check_in_end: data.checkInEnd || '10:00',
        work_days: data.workDays || '1,2,3,4,5',
      },
    });
  }

  /**
   * Slim variant — for validation, update guards, existence checks.
   * Does NOT load members array (saves I/O for callers that only need metadata).
   */
  async findByIdSlim(id: string) {
    return this.prisma.team.findFirst({
      where: this.where({ id }),
      select: {
        id: true,
        name: true,
        is_active: true,
        leader_id: true,
        supervisor_id: true,
        check_in_start: true,
        check_in_end: true,
        work_days: true,
        description: true,
      },
    });
  }

  /**
   * Full variant — for GET /teams/:id detail endpoint.
   * Includes all members, supervisor, and count.
   */
  async findById(id: string) {
    return this.prisma.team.findFirst({
      where: this.where({ id }),
      include: {
        members: {
          where: { is_active: true },
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            role: true,
          },
        },
        supervisor: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
        _count: {
          select: { members: true },
        },
      },
    });
  }

  async findPersonById(personId: string) {
    return this.prisma.person.findFirst({
      where: {
        id: personId,
        company_id: this.companyId,
        is_active: true,
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        role: true,
      },
    });
  }

  async findByName(name: string, excludeTeamId?: string): Promise<Team | null> {
    return this.prisma.team.findFirst({
      where: this.where({
        name,
        ...(excludeTeamId ? { id: { not: excludeTeamId } } : {}),
      }),
    });
  }

  async findAll(params: PaginationParams & { includeInactive?: boolean; search?: string }): Promise<PaginatedResponse<Team & { leader?: { id: string; first_name: string; last_name: string } }>> {
    const where: Prisma.TeamWhereInput = this.where({
      ...(params.includeInactive ? {} : { is_active: true }),
      ...(params.search ? { name: { startsWith: params.search, mode: 'insensitive' as const } } : {}),
    });

    const [items, total] = await Promise.all([
      this.prisma.team.findMany({
        where,
        skip: calculateSkip(params),
        take: params.limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          company_id: true,
          name: true,
          description: true,
          leader_id: true,
          supervisor_id: true,
          check_in_start: true,
          check_in_end: true,
          work_days: true,
          is_active: true,
          created_at: true,
          updated_at: true,
          leader: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
            },
          },
          supervisor: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
            },
          },
          _count: {
            select: { members: true },
          },
        },
      }),
      this.prisma.team.count({ where }),
    ]);

    return paginate(items, total, params);
  }

  async update(id: string, data: UpdateTeamData): Promise<Team> {
    return this.prisma.team.update({
      where: {
        id,
        company_id: this.companyId, // ✅ CRITICAL: Scope by company_id for multi-tenant security
      },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.leaderId !== undefined && { leader_id: data.leaderId }),
        ...(data.supervisorId !== undefined && { supervisor_id: data.supervisorId }),
        ...(data.isActive !== undefined && { is_active: data.isActive }),
        ...(data.checkInStart !== undefined && { check_in_start: data.checkInStart }),
        ...(data.checkInEnd !== undefined && { check_in_end: data.checkInEnd }),
        ...(data.workDays !== undefined && { work_days: data.workDays }),
      },
    });
  }

  /**
   * Check if a person already leads a team (excluding a specific team for edit scenarios)
   */
  async findByLeaderId(leaderId: string, excludeTeamId?: string): Promise<Team | null> {
    return this.prisma.team.findFirst({
      where: {
        company_id: this.companyId,
        leader_id: leaderId,
        is_active: true,
        ...(excludeTeamId ? { id: { not: excludeTeamId } } : {}),
      },
    });
  }
}
