import type {
  PrismaClient,
  IncidentSeverity,
  IncidentStatus,
} from '@prisma/client';
import type { IncidentWithRelations } from './incident.repository';
import type { CreateIncidentInput, RejectIncidentInput } from './incident.validator';
import { DateTime } from 'luxon';
import { AppError } from '../../shared/errors';
import { logAudit } from '../../shared/audit';
import { sendNotification, sendNotifications } from '../notification/notification.service';
import { buildEventData } from '../event/event.service';
import { logger } from '../../config/logger';

const VALID_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: [],
};

export class IncidentService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly timezone: string = 'Asia/Manila'
  ) {}

  /**
   * Create an incident with a retry loop for concurrent incident_number generation.
   * The @@unique([company_id, incident_number]) constraint guarantees uniqueness.
   * On P2002 (unique violation), retry up to 3 times.
   */
  async createIncident(
    data: CreateIncidentInput,
    companyId: string,
    reporterId: string
  ): Promise<IncidentWithRelations> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const incident = await this.prisma.$transaction(async (tx) => {
          const last = await tx.incident.findFirst({
            where: { company_id: companyId },
            orderBy: { incident_number: 'desc' },
            select: { incident_number: true },
          });
          const incidentNumber = (last?.incident_number ?? 0) + 1;

          const created = await tx.incident.create({
            data: {
              company_id: companyId,
              reporter_id: reporterId,
              incident_number: incidentNumber,
              incident_type: data.incidentType,
              severity: data.severity,
              title: data.title,
              location: data.location || null,
              description: data.description,
            },
            include: {
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
            },
          });

          // Event sourcing — inside transaction for consistency
          await tx.event.create({
            data: buildEventData({
              companyId,
              personId: reporterId,
              eventType: 'INCIDENT_CREATED',
              entityType: 'incident',
              entityId: created.id,
              payload: {
                incidentNumber,
                incidentType: data.incidentType,
                severity: data.severity,
                title: data.title,
              },
              timezone: this.timezone,
            }),
          });

          return created;
        });

        // Fire-and-forget: audit log
        logAudit({
          companyId,
          personId: reporterId,
          action: 'INCIDENT_CREATED',
          entityType: 'incident',
          entityId: incident.id,
          details: {
            incidentNumber: incident.incident_number,
            incidentType: data.incidentType,
            severity: data.severity,
          },
        });

        // Fire-and-forget: notify all WHS and ADMIN users in the company
        const reporterName = `${incident.reporter.first_name} ${incident.reporter.last_name}`;
        this.notifyWhsAndAdminIncidentSubmitted(
          companyId,
          incident.incident_number,
          incident.created_at,
          reporterName,
          data.severity,
          data.title
        );

        return incident;
      } catch (e: unknown) {
        if ((e as { code?: string }).code === 'P2002' && attempt < 2) continue;
        throw e;
      }
    }
    throw new AppError('CONFLICT', 'Failed to generate incident number, please retry', 409);
  }

  /**
   * Approve an incident and create a case in the same transaction.
   * Case number is generated with the same retry-safe pattern.
   */
  async approveIncident(
    incidentId: string,
    companyId: string,
    reviewerId: string
  ): Promise<IncidentWithRelations> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          // Fetch and validate INSIDE transaction to prevent TOCTOU race
          const existing = await tx.incident.findFirst({
            where: { id: incidentId, company_id: companyId },
            select: { id: true, status: true, reporter_id: true, incident_number: true, created_at: true },
          });

          if (!existing) {
            throw new AppError('NOT_FOUND', 'Incident not found', 404);
          }

          // Prevent self-approval — reviewer cannot be the reporter
          if (reviewerId === existing.reporter_id) {
            throw new AppError('CONFLICT', 'Cannot approve your own incident report', 409);
          }

          this.validateTransition(existing.status, 'APPROVED');

          // Update incident status
          const updated = await tx.incident.update({
            where: { id: incidentId, company_id: companyId },
            data: {
              status: 'APPROVED',
              reviewed_by: reviewerId,
              reviewed_at: new Date(),
            },
            include: {
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
            },
          });

          // Generate case number
          const lastCase = await tx.case.findFirst({
            where: { company_id: companyId },
            orderBy: { case_number: 'desc' },
            select: { case_number: true },
          });
          const caseNumber = (lastCase?.case_number ?? 0) + 1;

          // Create case record — auto-assign to the approving WHS officer
          const caseRecord = await tx.case.create({
            data: {
              company_id: companyId,
              case_number: caseNumber,
              incident_id: incidentId,
              assigned_to: reviewerId,
            },
          });

          // Parallel event creates — independent INSERTs within same transaction (Pattern 9)
          await Promise.all([
            tx.event.create({
              data: buildEventData({
                companyId,
                personId: reviewerId,
                eventType: 'INCIDENT_APPROVED',
                entityType: 'incident',
                entityId: incidentId,
                payload: {
                  incidentNumber: updated.incident_number,
                  caseId: caseRecord.id,
                  caseNumber,
                },
                timezone: this.timezone,
              }),
            }),
            tx.event.create({
              data: buildEventData({
                companyId,
                personId: reviewerId,
                eventType: 'CASE_CREATED',
                entityType: 'incident',
                entityId: incidentId,
                payload: {
                  caseId: caseRecord.id,
                  caseNumber,
                  status: 'OPEN',
                },
                timezone: this.timezone,
              }),
            }),
          ]);

          return { incident: updated, caseRecord, reporterId: existing.reporter_id, incidentNumber: existing.incident_number, createdAt: existing.created_at };
        });

        // Fire-and-forget: audit log
        logAudit({
          companyId,
          personId: reviewerId,
          action: 'INCIDENT_APPROVED',
          entityType: 'incident',
          entityId: incidentId,
          details: {
            caseId: result.caseRecord.id,
            caseNumber: result.caseRecord.case_number,
          },
        });

        // Fire-and-forget: notification to reporter
        this.notifyIncidentApproved(
          companyId,
          result.reporterId,
          result.incidentNumber,
          result.createdAt,
          result.caseRecord.case_number
        );

        // Combine transaction result with case data (avoids extra DB query)
        // The incident was fetched before case creation, so we manually attach the case
        return {
          ...result.incident,
          incident_case: {
            id: result.caseRecord.id,
            case_number: result.caseRecord.case_number,
            status: result.caseRecord.status,
            notes: result.caseRecord.notes,
          },
        } as IncidentWithRelations;
      } catch (e: unknown) {
        if ((e as { code?: string }).code === 'P2002' && attempt < 2) continue;
        throw e;
      }
    }
    throw new AppError('CONFLICT', 'Failed to generate case number, please retry', 409);
  }

  /**
   * Reject an incident with a reason and explanation.
   */
  async rejectIncident(
    incidentId: string,
    companyId: string,
    reviewerId: string,
    data: RejectIncidentInput
  ): Promise<IncidentWithRelations> {
    const result = await this.prisma.$transaction(async (tx) => {
      // Fetch and validate INSIDE transaction to prevent TOCTOU race
      const existing = await tx.incident.findFirst({
        where: { id: incidentId, company_id: companyId },
        select: { id: true, status: true, reporter_id: true, incident_number: true, created_at: true },
      });

      if (!existing) {
        throw new AppError('NOT_FOUND', 'Incident not found', 404);
      }

      // Prevent self-rejection — reviewer cannot be the reporter
      if (reviewerId === existing.reporter_id) {
        throw new AppError('CONFLICT', 'Cannot reject your own incident report', 409);
      }

      this.validateTransition(existing.status, 'REJECTED');

      const incident = await tx.incident.update({
        where: { id: incidentId, company_id: companyId },
        data: {
          status: 'REJECTED',
          reviewed_by: reviewerId,
          reviewed_at: new Date(),
          rejection_reason: data.rejectionReason,
          rejection_explanation: data.rejectionExplanation,
        },
        include: {
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
        },
      });

      // Event: INCIDENT_REJECTED
      await tx.event.create({
        data: buildEventData({
          companyId,
          personId: reviewerId,
          eventType: 'INCIDENT_REJECTED',
          entityType: 'incident',
          entityId: incidentId,
          payload: {
            incidentNumber: incident.incident_number,
            rejectionReason: data.rejectionReason,
            rejectionExplanation: data.rejectionExplanation,
          },
          timezone: this.timezone,
        }),
      });

      return { incident, reporterId: existing.reporter_id, incidentNumber: existing.incident_number, createdAt: existing.created_at };
    });

    // Fire-and-forget: audit log
    logAudit({
      companyId,
      personId: reviewerId,
      action: 'INCIDENT_REJECTED',
      entityType: 'incident',
      entityId: incidentId,
      details: {
        rejectionReason: data.rejectionReason,
        rejectionExplanation: data.rejectionExplanation,
      },
    });

    // Fire-and-forget: notification to reporter
    this.notifyIncidentRejected(
      companyId,
      result.reporterId,
      result.incidentNumber,
      result.createdAt,
      data.rejectionReason
    );

    return result.incident;
  }

  private validateTransition(currentStatus: IncidentStatus, newStatus: IncidentStatus): void {
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new AppError(
        'INVALID_TRANSITION',
        `Cannot transition from ${currentStatus} to ${newStatus}`,
        400
      );
    }
  }

  private formatIncidentRef(num: number, createdAt: Date): string {
    const year = DateTime.fromJSDate(createdAt).setZone(this.timezone).year;
    return `INC-${year}-${String(num).padStart(4, '0')}`;
  }

  private formatCaseRef(num: number): string {
    const year = DateTime.now().setZone(this.timezone).toFormat('yyyy');
    return `CASE-${year}-${String(num).padStart(4, '0')}`;
  }

  private formatRejectionReason(reason: string): string {
    const labels: Record<string, string> = {
      DUPLICATE_REPORT: 'Duplicate Report',
      INSUFFICIENT_INFORMATION: 'Insufficient Information',
      NOT_WORKPLACE_INCIDENT: 'Not a Workplace Incident',
      OTHER: 'Other',
    };
    return labels[reason] ?? reason;
  }

  private async notifyWhsAndAdminIncidentSubmitted(
    companyId: string,
    incidentNumber: number,
    createdAt: Date,
    reporterName: string,
    severity: IncidentSeverity,
    title: string
  ): Promise<void> {
    try {
      const whsAndAdmins = await this.prisma.person.findMany({
        where: {
          company_id: companyId,
          role: { in: ['WHS', 'ADMIN'] },
          is_active: true,
        },
        select: { id: true },
      });

      if (whsAndAdmins.length === 0) return;

      const ref = this.formatIncidentRef(incidentNumber, createdAt);
      sendNotifications(
        this.prisma,
        companyId,
        whsAndAdmins.map((person) => ({
          personId: person.id,
          type: 'INCIDENT_SUBMITTED' as const,
          title: 'New Incident Report Submitted',
          message: `${reporterName} submitted incident ${ref} (${severity}): ${title}`,
        }))
      );
    } catch (error) {
      logger.error(
        { error, companyId, incidentNumber },
        'Failed to send incident submission notifications to WHS/Admin users'
      );
    }
  }

  private notifyIncidentApproved(
    companyId: string,
    reporterId: string,
    incidentNumber: number,
    createdAt: Date,
    caseNumber: number
  ): void {
    const incRef = this.formatIncidentRef(incidentNumber, createdAt);
    const caseRef = this.formatCaseRef(caseNumber);
    sendNotification(this.prisma, companyId, {
      personId: reporterId,
      type: 'INCIDENT_APPROVED',
      title: 'Incident Report Approved',
      message: `Your incident report ${incRef} has been approved. Case ${caseRef} has been created.`,
    });
  }

  private notifyIncidentRejected(
    companyId: string,
    reporterId: string,
    incidentNumber: number,
    createdAt: Date,
    reason: string
  ): void {
    const ref = this.formatIncidentRef(incidentNumber, createdAt);
    const reasonLabel = this.formatRejectionReason(reason);
    sendNotification(this.prisma, companyId, {
      personId: reporterId,
      type: 'INCIDENT_REJECTED',
      title: 'Incident Report Not Approved',
      message: `Your incident report ${ref} was not approved. Reason: ${reasonLabel}.`,
    });
  }
}
