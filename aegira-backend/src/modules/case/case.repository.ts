import type { PrismaClient, Case, CaseStatus, Prisma } from '@prisma/client';
import { BaseRepository } from '../../shared/base.repository';
import { calculateSkip, paginate } from '../../shared/utils';
import type { PaginationParams, PaginatedResponse } from '../../types/api.types';

export interface CaseFilters extends PaginationParams {
  status?: CaseStatus;
  search?: string;
}

type CaseWithRelations = Case & {
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

export class CaseRepository extends BaseRepository {
  constructor(prisma: PrismaClient, companyId: string) {
    super(prisma, companyId);
  }

  private readonly includeRelations = {
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
  };

  async findById(id: string): Promise<CaseWithRelations | null> {
    return this.prisma.case.findFirst({
      where: this.where({ id }),
      include: this.includeRelations,
    }) as Promise<CaseWithRelations | null>;
  }

  async findByFilters(
    filters: CaseFilters
  ): Promise<PaginatedResponse<CaseWithRelations>> {
    const where: Prisma.CaseWhereInput = {
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

    const [items, total] = await Promise.all([
      this.prisma.case.findMany({
        where,
        include: this.includeRelations,
        orderBy: { created_at: 'desc' },
        skip: calculateSkip(filters),
        take: filters.limit,
      }),
      this.prisma.case.count({ where }),
    ]);

    return paginate(items as CaseWithRelations[], total, filters);
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
