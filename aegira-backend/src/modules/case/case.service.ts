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
  assignedTo?: string | null;
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
    // Validate assignee outside transaction (user input validation)
    if (data.assignedTo !== undefined && data.assignedTo !== null) {
      const assignee = await this.prisma.person.findFirst({
        where: { id: data.assignedTo, company_id: companyId },
        select: { id: true, role: true, is_active: true },
      });
      if (!assignee) {
        throw new AppError('INVALID_ASSIGNEE', 'Assignee not found', 400);
      }
      if (!['WHS', 'ADMIN'].includes(assignee.role)) {
        throw new AppError('INVALID_ASSIGNEE_ROLE', 'Assignee must have WHS or ADMIN role', 400);
      }
      if (!assignee.is_active) {
        throw new AppError('INVALID_ASSIGNEE', 'Assignee account is inactive', 400);
      }
    }

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

      // Validate status transition if status change requested
      if (data.status && data.status !== existing.status) {
        const allowed = VALID_TRANSITIONS[existing.status] || [];
        if (!allowed.includes(data.status)) {
          throw new AppError(
            'INVALID_TRANSITION',
            `Cannot transition from ${existing.status} to ${data.status}`,
            400
          );
        }
      }

      // Build update data
      const updateData: Prisma.CaseUpdateInput = {};

      if (data.status !== undefined) {
        updateData.status = data.status;
        if (data.status === 'RESOLVED') {
          updateData.resolved_at = new Date();
        }
      }

      if (data.assignedTo !== undefined) {
        if (data.assignedTo === null) {
          updateData.assignee = { disconnect: true };
        } else {
          updateData.assignee = { connect: { id: data.assignedTo } };
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

      // Determine event type
      const eventType = data.status === 'RESOLVED' ? 'CASE_RESOLVED' : 'CASE_UPDATED';

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
            ...(data.status && { status: data.status, previousStatus: existing.status }),
            ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo }),
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
      action: data.status === 'RESOLVED' ? 'CASE_RESOLVED' : 'CASE_UPDATED',
      entityType: 'case',
      entityId: caseId,
      details: {
        caseNumber: updated.case_number,
        ...(data.status && { status: data.status }),
        ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo }),
      },
    });

    return updated;
  }
}
