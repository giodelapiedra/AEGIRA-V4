import type { PrismaClient, Case, CaseStatus, Prisma } from '@prisma/client';
import { CaseRepository } from './case.repository';
import { AppError } from '../../shared/errors';
import { logAudit } from '../../shared/audit';

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
    private readonly repository: CaseRepository
  ) {}

  async updateCase(
    caseId: string,
    companyId: string,
    updaterId: string,
    data: UpdateCaseInput
  ): Promise<Case> {
    const existing = await this.repository.findById(caseId);

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
        // Validate assignee: must exist, same company, WHS/ADMIN role, active
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
        updateData.assignee = { connect: { id: data.assignedTo } };
      }
    }

    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    // Update with event sourcing inside transaction
    const updated = await this.prisma.$transaction(async (tx) => {
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
        data: {
          company_id: companyId,
          person_id: updaterId,
          event_type: eventType,
          entity_type: 'incident',
          entity_id: caseRecord.incident_id,
          payload: {
            caseId: caseRecord.id,
            caseNumber: caseRecord.case_number,
            ...(data.status && { status: data.status, previousStatus: existing.status }),
            ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo }),
            ...(data.notes !== undefined && { notesUpdated: true }),
          } as Prisma.InputJsonValue,
        },
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
