// Person Repository - Database Access
import type { PrismaClient, Person, Prisma, Role, Gender } from '@prisma/client';
import { BaseRepository } from '../../shared/base.repository';
import { AppError } from '../../shared/errors';
import { calculateSkip, paginate } from '../../shared/utils';
import type { PaginationParams, PaginatedResponse } from '../../types/api.types';

/**
 * Fields returned by all Person read/write queries.
 * Excludes password_hash — it must never leave the repository layer.
 */
const SAFE_PERSON_SELECT = {
  id: true,
  company_id: true,
  email: true,
  first_name: true,
  last_name: true,
  gender: true,
  date_of_birth: true,
  profile_picture_url: true,
  role: true,
  team_id: true,
  team_assigned_at: true,
  work_days: true,
  check_in_start: true,
  check_in_end: true,
  is_active: true,
  created_at: true,
  updated_at: true,
} as const;

/** Person without password_hash */
export type SafePerson = Omit<Person, 'password_hash'>;

/** Person without password_hash, with team relation */
export type SafePersonWithTeam = SafePerson & {
  team: { id: string; name: string; check_in_start: string; check_in_end: string; work_days: string } | null;
};

export interface CreatePersonData {
  email: string;
  passwordHash?: string;
  firstName: string;
  lastName: string;
  role?: Role;
  teamId?: string;
  gender?: Gender;
  dateOfBirth?: string; // ISO date string "YYYY-MM-DD"
  workDays?: string; // CSV: "0,1,2,3,4,5,6" - worker schedule override
  checkInStart?: string; // HH:mm format - worker schedule override
  checkInEnd?: string; // HH:mm format - worker schedule override
}

export interface UpdatePersonData {
  firstName?: string;
  lastName?: string;
  role?: Role;
  teamId?: string | null;
  isActive?: boolean;
  gender?: Gender | null;
  dateOfBirth?: string | null; // ISO date string "YYYY-MM-DD" or null to clear
  profilePictureUrl?: string | null;
  workDays?: string | null; // CSV: "0,1,2,3,4,5,6" - worker schedule override (null clears override)
  checkInStart?: string | null; // HH:mm format - worker schedule override (null clears override)
  checkInEnd?: string | null; // HH:mm format - worker schedule override (null clears override)
}

export class PersonRepository extends BaseRepository {
  constructor(prisma: PrismaClient, companyId: string) {
    super(prisma, companyId);
  }

  async create(data: CreatePersonData): Promise<SafePerson> {
    try {
      return await this.prisma.person.create({
        data: {
          company_id: this.companyId,
          email: data.email.toLowerCase(),
          password_hash: data.passwordHash,
          first_name: data.firstName,
          last_name: data.lastName,
          role: data.role ?? 'WORKER',
          team_id: data.teamId,
          // Set team_assigned_at if worker is assigned to a team
          team_assigned_at: data.teamId ? new Date() : null,
          gender: data.gender,
          date_of_birth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
          // Worker schedule override (optional)
          work_days: data.workDays,
          check_in_start: data.checkInStart,
          check_in_end: data.checkInEnd,
        },
        select: SAFE_PERSON_SELECT,
      });
    } catch (error: unknown) {
      // Handle foreign key constraint violations
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === 'P2003') {
          // Foreign key constraint failed
          const meta = 'meta' in error && error.meta && typeof error.meta === 'object' 
            ? error.meta 
            : null;
          const fieldName = meta && 'field_name' in meta 
            ? String(meta.field_name) 
            : 'unknown';
          
          if (fieldName.includes('company_id')) {
            throw new AppError('INVALID_COMPANY', `Company with ID ${this.companyId} does not exist`, 400);
          }
          if (fieldName.includes('team_id')) {
            throw new AppError('INVALID_TEAM', `Team with ID ${data.teamId} does not exist`, 400);
          }
        }
      }
      throw error;
    }
  }

  async findById(id: string): Promise<SafePersonWithTeam | null> {
    return this.prisma.person.findFirst({
      where: this.where({ id }),
      select: {
        ...SAFE_PERSON_SELECT,
        team: { select: { id: true, name: true, check_in_start: true, check_in_end: true, work_days: true } },
      },
    });
  }

  async findByEmail(email: string): Promise<{ id: string } | null> {
    return this.prisma.person.findFirst({
      where: this.where({ email: email.toLowerCase() }),
      select: { id: true },
    });
  }

  async findAll(params: PaginationParams & { includeInactive?: boolean; role?: Role; availableOnly?: boolean; excludeTeamId?: string; search?: string }): Promise<PaginatedResponse<SafePersonWithTeam>> {
    // Build the filter for available team leads
    let availableFilter: Prisma.PersonWhereInput = {};
    if (params.availableOnly) {
      if (params.excludeTeamId) {
        // Include team leads who have no teams OR are leading the excluded team (for edit scenarios)
        availableFilter = {
          OR: [
            { led_teams: { none: {} } },
            { led_teams: { some: { id: params.excludeTeamId } } },
          ],
        };
      } else {
        // Only include team leads who have no teams
        availableFilter = { led_teams: { none: {} } };
      }
    }

    // Build search filter - use startsWith for names (can use index), contains for email
    let searchFilter: Prisma.PersonWhereInput = {};
    if (params.search) {
      searchFilter = {
        OR: [
          { first_name: { startsWith: params.search, mode: 'insensitive' } },
          { last_name: { startsWith: params.search, mode: 'insensitive' } },
          { email: { contains: params.search, mode: 'insensitive' } },
        ],
      };
    }

    // Combine filters properly - AND all conditions together
    const conditions: Prisma.PersonWhereInput[] = [
      { company_id: this.companyId },
      ...(params.includeInactive ? [] : [{ is_active: true }]),
      ...(params.role ? [{ role: params.role }] : []),
      ...(Object.keys(availableFilter).length > 0 ? [availableFilter] : []),
      ...(Object.keys(searchFilter).length > 0 ? [searchFilter] : []),
    ];

    const where: Prisma.PersonWhereInput = {
      AND: conditions,
    };

    const [items, total] = await Promise.all([
      this.prisma.person.findMany({
        where,
        skip: calculateSkip(params),
        take: params.limit,
        orderBy: { last_name: 'asc' },
        select: {
          ...SAFE_PERSON_SELECT,
          team: { select: { id: true, name: true, check_in_start: true, check_in_end: true, work_days: true } },
        },
      }),
      this.prisma.person.count({ where }),
    ]);

    return paginate(items, total, params);
  }

  async findByTeam(teamId: string, params: PaginationParams): Promise<PaginatedResponse<SafePerson>> {
    const where: Prisma.PersonWhereInput = this.where({
      team_id: teamId,
      is_active: true,
    });

    const [items, total] = await Promise.all([
      this.prisma.person.findMany({
        where,
        skip: calculateSkip(params),
        take: params.limit,
        orderBy: { last_name: 'asc' },
        select: SAFE_PERSON_SELECT,
      }),
      this.prisma.person.count({ where }),
    ]);

    return paginate(items, total, params);
  }

  async update(id: string, data: UpdatePersonData): Promise<SafePerson> {
    // If team is changing, update team_assigned_at
    const teamAssignedAt = data.teamId !== undefined
      ? (data.teamId ? new Date() : null)  // New team = now, removed from team = null
      : undefined;  // Not changing team

    try {
      return await this.prisma.person.update({
        where: {
          id,
          company_id: this.companyId, // CRITICAL: Scope by company_id for multi-tenant security
        },
        data: {
          ...(data.firstName !== undefined && { first_name: data.firstName }),
          ...(data.lastName !== undefined && { last_name: data.lastName }),
          ...(data.role !== undefined && { role: data.role }),
          ...(data.teamId !== undefined && { team_id: data.teamId }),
          ...(teamAssignedAt !== undefined && { team_assigned_at: teamAssignedAt }),
          ...(data.isActive !== undefined && { is_active: data.isActive }),
          ...(data.gender !== undefined && { gender: data.gender }),
          ...(data.dateOfBirth !== undefined && { date_of_birth: data.dateOfBirth ? new Date(data.dateOfBirth) : null }),
          ...(data.profilePictureUrl !== undefined && { profile_picture_url: data.profilePictureUrl }),
          // Worker schedule override (undefined = no change, null = clear override, value = set override)
          ...(data.workDays !== undefined && { work_days: data.workDays }),
          ...(data.checkInStart !== undefined && { check_in_start: data.checkInStart }),
          ...(data.checkInEnd !== undefined && { check_in_end: data.checkInEnd }),
        },
        select: SAFE_PERSON_SELECT,
      });
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === 'P2003') {
          const meta = 'meta' in error && error.meta && typeof error.meta === 'object'
            ? error.meta
            : null;
          const fieldName = meta && 'field_name' in meta
            ? String(meta.field_name)
            : 'unknown';

          if (fieldName.includes('team_id')) {
            throw new AppError('INVALID_TEAM', `Team with ID ${data.teamId} does not exist`, 400);
          }
        }
        if (error.code === 'P2025') {
          throw new AppError('NOT_FOUND', 'Person not found', 404);
        }
      }
      throw error;
    }
  }

  async countActive(): Promise<number> {
    return this.prisma.person.count({
      where: this.where({ is_active: true }),
    });
  }

  /**
   * Find workers with team filtering
   * Used by team management endpoints to list workers
   */
  async findWorkers(
    params: PaginationParams,
    teamIds?: string[] | null
  ): Promise<PaginatedResponse<SafePersonWithTeam>> {
    const teamFilter = teamIds ? { team_id: { in: teamIds } } : {};

    const [items, total] = await Promise.all([
      this.prisma.person.findMany({
        where: this.where({
          role: 'WORKER',
          is_active: true,
          ...teamFilter,
        }),
        select: {
          ...SAFE_PERSON_SELECT,
          team: { select: { id: true, name: true, check_in_start: true, check_in_end: true, work_days: true } },
        },
        skip: calculateSkip(params),
        take: params.limit,
        orderBy: { last_name: 'asc' },
      }),
      this.prisma.person.count({
        where: this.where({
          role: 'WORKER',
          is_active: true,
          ...teamFilter,
        }),
      }),
    ]);

    return paginate(items as SafePersonWithTeam[], total, params);
  }
}
