import type { PrismaClient, CaseStatus, Prisma } from '@prisma/client';
import { CaseRepository, type CaseWithRelations } from './case.repository';
import { AppError } from '../../shared/errors';
import { logAudit } from '../../shared/audit';
import { buildEventData } from '../event/event.service';

const VALID_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  OPEN: ['INVESTIGATING', 'RESOLVED', 'CLOSED'],
  INVESTIGATING: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

interface UpdateCaseInput {
  status?: CaseStatus;
  notes?: string;
}

export class CaseService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly repository: CaseRepository,
    private readonly timezone: string = 'Asia/Manila'
  ) {}

  async updateCase(
    caseId: string,
    companyId: string,
    updaterId: string,
    data: UpdateCaseInput
  ): Promise<CaseWithRelations> {
    // Track effective status outside transaction for audit log
    let effectiveStatus: CaseStatus | undefined;

    // Update with event sourcing inside transaction
    // All case existence checks and status validation are inside transaction to avoid TOCTOU race
    const updated = await this.prisma.$transaction(async (tx) => {
      // Fetch existing case INSIDE transaction to avoid race condition
      const existing = await tx.case.findFirst({
        where: { id: caseId, company_id: companyId },
        select: { id: true, status: true, case_number: true, incident_id: true },
      });

      if (!existing) {
        throw new AppError('NOT_FOUND', 'Case not found', 404);
      }

      // Determine effective status: strip same-status no-ops without mutating input
      if (data.status && data.status !== existing.status) {
        const allowed = VALID_TRANSITIONS[existing.status] || [];
        if (!allowed.includes(data.status)) {
          throw new AppError(
            'INVALID_TRANSITION',
            `Cannot transition from ${existing.status} to ${data.status}`,
            400
          );
        }
        effectiveStatus = data.status;
      }

      // Build update data
      const updateData: Prisma.CaseUpdateInput = {};

      if (effectiveStatus !== undefined) {
        updateData.status = effectiveStatus;
        if (effectiveStatus === 'RESOLVED' || effectiveStatus === 'CLOSED') {
          updateData.resolved_at = new Date();
        }
      }

      if (data.notes !== undefined) {
        updateData.notes = data.notes;
      }

      const caseRecord = await tx.case.update({
        where: { id: caseId, company_id: companyId },
        data: updateData,
        include: {
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
              created_at: true,
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
        },
      });

      // Determine event type (RESOLVED and CLOSED are both terminal — use CASE_RESOLVED for both)
      const eventType = (effectiveStatus === 'RESOLVED' || effectiveStatus === 'CLOSED')
        ? 'CASE_RESOLVED'
        : 'CASE_UPDATED';

      // Event sourcing — entity_type='incident' for unified timeline
      await tx.event.create({
        data: buildEventData({
          companyId,
          personId: updaterId,
          eventType,
          entityType: 'incident',
          entityId: caseRecord.incident_id,
          payload: {
            caseId: caseRecord.id,
            caseNumber: caseRecord.case_number,
            ...(effectiveStatus && { status: effectiveStatus, previousStatus: existing.status }),
            ...(data.notes !== undefined && { notesUpdated: true }),
          },
          timezone: this.timezone,
        }),
      });

      return caseRecord;
    });

    // Fire-and-forget: audit log
    logAudit({
      companyId,
      personId: updaterId,
      action: (effectiveStatus === 'RESOLVED' || effectiveStatus === 'CLOSED')
        ? 'CASE_RESOLVED'
        : 'CASE_UPDATED',
      entityType: 'case',
      entityId: caseId,
      details: {
        caseNumber: updated.case_number,
        ...(effectiveStatus && { status: effectiveStatus }),
      },
    });

    return updated;
  }
}
