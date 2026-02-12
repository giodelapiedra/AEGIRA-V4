// Admin Repository - Database Access
import type { PrismaClient, Company, Holiday, AuditLog, Person, Prisma, Role } from '@prisma/client';
import { BaseRepository } from '../../shared/base.repository';
import { calculateSkip, paginate } from '../../shared/utils';
import type { PaginationParams, PaginatedResponse } from '../../types/api.types';

export interface UpdateCompanyData {
  name?: string;
  timezone?: string;
  industry?: string | null;
  businessRegistrationType?: string;
  businessRegistrationNumber?: string;
  businessType?: string;
  addressStreet?: string;
  addressCity?: string;
  addressPostalCode?: string;
  addressState?: string;
  addressCountry?: string;
}

export interface CreateHolidayData {
  name: string;
  date: Date;
  isRecurring?: boolean;
}

export interface UpdateHolidayData {
  name?: string;
  date?: Date;
  isRecurring?: boolean;
}

export interface AuditLogFilters {
  type?: string;
  search?: string;
  dateFilter?: string;
}

export interface PersonFilters {
  search?: string;
}

export class AdminRepository extends BaseRepository {
  constructor(prisma: PrismaClient, companyId: string) {
    super(prisma, companyId);
  }

  // ==================== Company Operations ====================

  async findCompanyById(): Promise<Company | null> {
    return this.prisma.company.findUnique({
      where: { id: this.companyId },
    });
  }

  async updateCompany(data: UpdateCompanyData): Promise<Company> {
    const updateData: Prisma.CompanyUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.industry !== undefined) updateData.industry = data.industry || null;
    if (data.businessRegistrationType !== undefined) updateData.business_registration_type = data.businessRegistrationType;
    if (data.businessRegistrationNumber !== undefined) updateData.business_registration_number = data.businessRegistrationNumber;
    if (data.businessType !== undefined) updateData.business_type = data.businessType;
    if (data.addressStreet !== undefined) updateData.address_street = data.addressStreet;
    if (data.addressCity !== undefined) updateData.address_city = data.addressCity;
    if (data.addressPostalCode !== undefined) updateData.address_postal_code = data.addressPostalCode;
    if (data.addressState !== undefined) updateData.address_state = data.addressState;
    if (data.addressCountry !== undefined) updateData.address_country = data.addressCountry;

    return this.prisma.company.update({
      where: { id: this.companyId },
      data: updateData,
    });
  }

  // ==================== Holiday Operations ====================

  async listHolidays(year: string): Promise<Holiday[]> {
    return this.prisma.holiday.findMany({
      where: this.where({
        date: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`),
        },
      }),
      orderBy: { date: 'asc' },
    });
  }

  async createHoliday(data: CreateHolidayData): Promise<Holiday> {
    return this.prisma.holiday.create({
      data: this.withCompany({
        name: data.name,
        date: data.date,
        is_recurring: data.isRecurring ?? false,
      }),
    });
  }

  async updateHoliday(id: string, data: UpdateHolidayData): Promise<Holiday | null> {
    // First verify the holiday exists in this company
    const existing = await this.prisma.holiday.findFirst({
      where: this.where({ id }),
    });

    if (!existing) {
      return null;
    }

    // Build update data
    const updateData: Prisma.HolidayUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.date !== undefined) updateData.date = data.date;
    if (data.isRecurring !== undefined) updateData.is_recurring = data.isRecurring;

    // Update using verified id (single query instead of updateMany + findFirst)
    return this.prisma.holiday.update({
      where: { id: existing.id },
      data: updateData,
    });
  }

  async findHolidayById(id: string): Promise<Holiday | null> {
    return this.prisma.holiday.findFirst({
      where: this.where({ id }),
    });
  }

  async deleteHoliday(id: string): Promise<boolean> {
    // Use deleteMany with company_id filter for multi-tenant safety
    const result = await this.prisma.holiday.deleteMany({
      where: this.where({ id }),
    });
    return result.count > 0;
  }

  // ==================== Audit Log Operations ====================

  async listAuditLogs(
    pagination: PaginationParams,
    filters: AuditLogFilters
  ): Promise<PaginatedResponse<AuditLog & { person: Person | null }>> {
    const where: Prisma.AuditLogWhereInput = this.where({});

    if (filters.type) {
      where.action = filters.type;
    }

    if (filters.dateFilter) {
      const date = new Date(filters.dateFilter);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      where.created_at = { gte: date, lt: nextDay };
    }

    if (filters.search) {
      where.person = {
        OR: [
          { first_name: { startsWith: filters.search, mode: 'insensitive' } },
          { last_name: { startsWith: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: calculateSkip(pagination),
        take: pagination.limit,
        orderBy: { created_at: 'desc' },
        include: {
          person: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
              role: true,
              company_id: true,
              is_active: true,
              created_at: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginate(items, total, pagination);
  }

  // ==================== Person/User Role Operations ====================

  async listPersons(
    pagination: PaginationParams,
    filters: PersonFilters
  ): Promise<PaginatedResponse<Person>> {
    const where: Prisma.PersonWhereInput = this.where({});

    if (filters.search) {
      where.OR = [
        { first_name: { startsWith: filters.search, mode: 'insensitive' } },
        { last_name: { startsWith: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.person.findMany({
        where,
        skip: calculateSkip(pagination),
        take: pagination.limit,
        orderBy: { first_name: 'asc' },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          role: true,
          is_active: true,
          company_id: true,
          created_at: true,
        },
      }),
      this.prisma.person.count({ where }),
    ]);

    return paginate(items as Person[], total, pagination);
  }

  async updatePersonRole(id: string, role: Role): Promise<Person | null> {
    // First verify the person exists in this company
    const existing = await this.prisma.person.findFirst({
      where: this.where({ id }),
    });

    if (!existing) {
      return null;
    }

    // Update using verified id (single query instead of updateMany + findFirst)
    return this.prisma.person.update({
      where: { id: existing.id },
      data: { role },
    });
  }

  async findPersonById(id: string): Promise<Person | null> {
    return this.prisma.person.findFirst({
      where: this.where({ id }),
    });
  }
}
