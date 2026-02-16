import type { PrismaClient, Case, CaseStatus, Prisma } from '@prisma/client';
import { BaseRepository } from '../../shared/base.repository';
import { calculateSkip, paginate } from '../../shared/utils';
import type { PaginationParams, PaginatedResponse } from '../../types/api.types';

export interface CaseFilters extends PaginationParams {
  status?: CaseStatus;
  search?: string;
}

export type CaseWithRelations = Case & {
  incident: {
    id: string;
    incident_number: number;
    incident_type: string;
    severity: string;
    title: string;
    location: string | null;
    description: string;
    status: string;
    reporter: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      gender: string | null;
      date_of_birth: Date | null;
      team: { id: string; name: string } | null;
    };
  };
  assignee: { id: string; first_name: string; last_name: string } | null;
};

/** Lean type for list views — only fields the table needs */
export interface CaseListItem {
  id: string;
  case_number: number;
  status: CaseStatus;
  created_at: Date;
  incident: {
    title: string;
    severity: string;
    reporter: { first_name: string; last_name: string };
  };
  assignee: { first_name: string; last_name: string } | null;
}

export class CaseRepository extends BaseRepository {
  constructor(prisma: PrismaClient, companyId: string) {
    super(prisma, companyId);
  }

  /** Lean select for list views — only fields the table needs */
  private readonly selectForList = {
    id: true,
    case_number: true,
    status: true,
    created_at: true,
    incident: {
      select: {
        title: true,
        severity: true,
        reporter: {
          select: { first_name: true, last_name: true },
        },
      },
    },
    assignee: {
      select: { first_name: true, last_name: true },
    },
  } as const;

  /** Full select for detail views */
  private readonly selectWithRelations = {
    id: true,
    company_id: true,
    case_number: true,
    incident_id: true,
    assigned_to: true,
    status: true,
    notes: true,
    resolved_at: true,
    created_at: true,
    updated_at: true,
    incident: {
      select: {
        id: true,
        incident_number: true,
        incident_type: true,
        severity: true,
        title: true,
        location: true,
        description: true,
        status: true,
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
      },
    },
    assignee: {
      select: { id: true, first_name: true, last_name: true },
    },
  } as const;

  async findById(id: string): Promise<CaseWithRelations | null> {
    return this.prisma.case.findFirst({
      where: this.where({ id }),
      select: this.selectWithRelations,
    }) as Promise<CaseWithRelations | null>;
  }

  private buildFiltersWhere(filters: CaseFilters): Prisma.CaseWhereInput {
    return {
      company_id: this.companyId,
      ...(filters.status && { status: filters.status }),
      ...(filters.search && {
        OR: [
          {
            incident: {
              title: { contains: filters.search, mode: 'insensitive' as const },
            },
          },
          {
            incident: {
              reporter: {
                OR: [
                  { first_name: { contains: filters.search, mode: 'insensitive' as const } },
                  { last_name: { contains: filters.search, mode: 'insensitive' as const } },
                ],
              },
            },
          },
        ],
      }),
    };
  }

  async findForList(
    filters: CaseFilters
  ): Promise<PaginatedResponse<CaseListItem>> {
    const where = this.buildFiltersWhere(filters);

    const [items, total] = await Promise.all([
      this.prisma.case.findMany({
        where,
        select: this.selectForList,
        orderBy: { created_at: 'desc' },
        skip: calculateSkip(filters),
        take: filters.limit,
      }),
      this.prisma.case.count({ where }),
    ]);

    return paginate(items as CaseListItem[], total, filters);
  }

  async countByStatus(): Promise<Record<string, number>> {
    const where: Prisma.CaseWhereInput = {
      company_id: this.companyId,
    };

    const counts = await this.prisma.case.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    const result: Record<string, number> = {
      OPEN: 0,
      INVESTIGATING: 0,
      RESOLVED: 0,
      CLOSED: 0,
    };

    for (const c of counts) {
      result[c.status] = c._count;
    }

    return result;
  }
}
