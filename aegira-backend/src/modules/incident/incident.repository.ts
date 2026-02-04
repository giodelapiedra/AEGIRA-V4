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

type IncidentWithRelations = Incident & {
  reporter: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    team: { id: string; name: string } | null;
  };
  reviewer: { id: string; first_name: string; last_name: string } | null;
  incident_case: { id: string; case_number: number; status: string; notes: string | null } | null;
};

export class IncidentRepository extends BaseRepository {
  constructor(prisma: PrismaClient, companyId: string) {
    super(prisma, companyId);
  }

  private readonly includeRelations = {
    reporter: {
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        team: { select: { id: true, name: true } },
      },
    },
    reviewer: {
      select: { id: true, first_name: true, last_name: true },
    },
    incident_case: {
      select: { id: true, case_number: true, status: true, notes: true },
    },
  };

  async findById(id: string): Promise<IncidentWithRelations | null> {
    return this.prisma.incident.findFirst({
      where: this.where({ id }),
      include: this.includeRelations,
    }) as Promise<IncidentWithRelations | null>;
  }

  async findByFilters(
    filters: IncidentFilters
  ): Promise<PaginatedResponse<IncidentWithRelations>> {
    const where: Prisma.IncidentWhereInput = {
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

    const [items, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        include: this.includeRelations,
        orderBy: { created_at: 'desc' },
        skip: calculateSkip(filters),
        take: filters.limit,
      }),
      this.prisma.incident.count({ where }),
    ]);

    return paginate(items as IncidentWithRelations[], total, filters);
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
      include: {
        person: {
          select: { id: true, first_name: true, last_name: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });
  }
}
