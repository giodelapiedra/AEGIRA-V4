// Base Repository with Tenant Isolation
import { PrismaClient } from '@prisma/client';

export abstract class BaseRepository {
  constructor(
    protected readonly prisma: PrismaClient,
    protected readonly companyId: string
  ) {}

  /**
   * Adds company_id filter to all queries
   * This ensures multi-tenant isolation
   */
  protected where<T extends Record<string, unknown>>(conditions: T): T & { company_id: string } {
    return {
      ...conditions,
      company_id: this.companyId,
    };
  }

  /**
   * Creates data with company_id attached
   */
  protected withCompany<T extends Record<string, unknown>>(data: T): T & { company_id: string } {
    return {
      ...data,
      company_id: this.companyId,
    };
  }
}
