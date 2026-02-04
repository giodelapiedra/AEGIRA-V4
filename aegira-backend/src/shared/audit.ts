// Shared Audit Logging Utility
// Fire-and-forget pattern - never blocks the main operation
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

interface AuditLogInput {
  companyId: string;
  personId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

/**
 * Create an audit log entry (non-blocking fire-and-forget).
 * Errors are logged but never thrown — audit failure must not break the main operation.
 */
export function logAudit(input: AuditLogInput): void {
  prisma.auditLog
    .create({
      data: {
        company_id: input.companyId,
        person_id: input.personId,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId || null,
        details: (input.details || {}) as Prisma.InputJsonValue,
      },
    })
    .catch((error: unknown) => {
      logger.error({ error, action: input.action, entityType: input.entityType }, 'Failed to create audit log');
    });
}
