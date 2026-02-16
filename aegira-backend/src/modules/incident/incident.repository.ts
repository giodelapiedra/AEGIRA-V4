import type {
  PrismaClient,
  Incident,
  IncidentStatus,
  IncidentSeverity,
  IncidentType,
  Prisma,
} from '@prisma/client';
import { BaseRepository } from '../../shared/base.repository';
import { calculateSkip, paginate } from '../../shared/utils';
import type { PaginationParams, PaginatedResponse } from '../../types/api.types';

export interface CreateIncidentData {
  incidentNumber: number;
  reporterId: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  title: string;
  location?: string;
  description: string;
}

export interface IncidentFilters extends PaginationParams {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  type?: IncidentType;
  search?: string;
  reporterId?: string;
}

export type IncidentWithRelations = Incident & {
  reporter: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    gender: string | null;
    date_of_birth: Date | null;
    team: { id: string; name: string } | null;
  };
  reviewer: { id: string; first_name: string; last_name: string } | null;
  incident_case: { id: string; case_number: number; status: string; notes: string | null } | null;
};

/** Lean type for list views — only fields the table needs */
export interface IncidentListItem {
  id: string;
  incident_number: number;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  status: IncidentStatus;
  created_at: Date;
  reporter: {
    first_name: string;
    last_name: string;
    team: { name: string } | null;
  };
  reviewer: { first_name: string; last_name: string } | null;
}

export class IncidentRepository extends BaseRepository {
  constructor(prisma: PrismaClient, companyId: string) {
    super(prisma, companyId);
  }

  /** Lean select for list views — only fields the table needs */
  private readonly selectForList = {
    id: true,
    incident_number: true,
    incident_type: true,
    severity: true,
    title: true,
    status: true,
    created_at: true,
    reporter: {
      select: {
        first_name: true,
        last_name: true,
        team: { select: { name: true } },
      },
    },
    reviewer: {
      select: { first_name: true, last_name: true },
    },
  } as const;

  /** Full select for detail views — includes all fields + case */
  private readonly selectWithRelations = {
    id: true,
    company_id: true,
    incident_number: true,
    reporter_id: true,
    incident_type: true,
    severity: true,
    title: true,
    location: true,
    description: true,
    status: true,
    reviewed_by: true,
    reviewed_at: true,
    rejection_reason: true,
    rejection_explanation: true,
    created_at: true,
    updated_at: true,
    reporter: {
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        gender: true,
        date_of_birth: true,
        team: { select: { id: true, name: true } },
      },
    },
    reviewer: {
      select: { id: true, first_name: true, last_name: true },
    },
    incident_case: {
      select: { id: true, case_number: true, status: true, notes: true },
    },
  } as const;

  async findById(id: string): Promise<IncidentWithRelations | null> {
    return this.prisma.incident.findFirst({
      where: this.where({ id }),
      select: this.selectWithRelations,
    }) as Promise<IncidentWithRelations | null>;
  }

  private buildFiltersWhere(filters: IncidentFilters): Prisma.IncidentWhereInput {
    return {
      company_id: this.companyId,
      ...(filters.status && { status: filters.status }),
      ...(filters.severity && { severity: filters.severity }),
      ...(filters.type && { incident_type: filters.type }),
      ...(filters.reporterId && { reporter_id: filters.reporterId }),
      ...(filters.search && {
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' as const } },
          {
            reporter: {
              OR: [
                { first_name: { contains: filters.search, mode: 'insensitive' as const } },
                { last_name: { contains: filters.search, mode: 'insensitive' as const } },
              ],
            },
          },
        ],
      }),
    };
  }

  /**
   * Lean list query — returns only fields the table needs.
   * When `total` is provided (e.g. derived from statusCounts), skips the COUNT query.
   */
  async findForList(
    filters: IncidentFilters,
    knownTotal?: number
  ): Promise<PaginatedResponse<IncidentListItem>> {
    const where = this.buildFiltersWhere(filters);

    if (knownTotal !== undefined) {
      const items = await this.prisma.incident.findMany({
        where,
        select: this.selectForList,
        orderBy: { created_at: 'desc' },
        skip: calculateSkip(filters),
        take: filters.limit,
      });
      return paginate(items as IncidentListItem[], knownTotal, filters);
    }

    const [items, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        select: this.selectForList,
        orderBy: { created_at: 'desc' },
        skip: calculateSkip(filters),
        take: filters.limit,
      }),
      this.prisma.incident.count({ where }),
    ]);

    return paginate(items as IncidentListItem[], total, filters);
  }

  async countByStatus(reporterId?: string): Promise<Record<string, number>> {
    const where: Prisma.IncidentWhereInput = {
      company_id: this.companyId,
      ...(reporterId && { reporter_id: reporterId }),
    };

    const counts = await this.prisma.incident.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    const result: Record<string, number> = {
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
    };

    for (const c of counts) {
      result[c.status] = c._count;
    }

    return result;
  }

  async getTimeline(incidentId: string): Promise<unknown[]> {
    return this.prisma.event.findMany({
      where: {
        company_id: this.companyId,
        entity_type: 'incident',
        entity_id: incidentId,
      },
      select: {
        id: true,
        event_type: true,
        person_id: true,
        payload: true,
        created_at: true,
        event_time: true,
        person: {
          select: { id: true, first_name: true, last_name: true },
        },
      },
      orderBy: { created_at: 'asc' },
      take: 200,
    });
  }
}
