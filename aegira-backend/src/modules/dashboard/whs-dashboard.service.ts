// WHS Dashboard Service - Incident & Case Monitoring
import { prisma } from '../../config/database';
import { DateTime } from 'luxon';

// Human-readable event messages
function formatEventMessage(
  eventType: string,
  payload: Record<string, unknown>,
  personName: string | null
): string {
  const actor = personName || 'System';

  switch (eventType) {
    case 'INCIDENT_CREATED': {
      const type = payload.incidentType || payload.incident_type || 'incident';
      const severity = payload.severity || '';
      return `${actor} reported ${String(type).replace(/_/g, ' ')} (${severity})`;
    }
    case 'INCIDENT_APPROVED': {
      const incidentNum = payload.incidentNumber || payload.incident_number || '';
      const caseNum = payload.caseNumber || payload.case_number || '';
      return `${actor} approved Incident #${incidentNum}` +
        (caseNum ? ` — Case #${caseNum} created` : '');
    }
    case 'INCIDENT_REJECTED': {
      const incidentNum = payload.incidentNumber || payload.incident_number || '';
      const reason = payload.rejectionReason || payload.rejection_reason || '';
      return `${actor} rejected Incident #${incidentNum}` +
        (reason ? ` — ${String(reason).replace(/_/g, ' ')}` : '');
    }
    case 'CASE_CREATED': {
      const caseNum = payload.caseNumber || payload.case_number || '';
      return `Case #${caseNum} created`;
    }
    case 'CASE_UPDATED': {
      const caseNum = payload.caseNumber || payload.case_number || '';
      const newStatus = payload.status || payload.newStatus || '';
      if (newStatus) {
        return `Case #${caseNum} moved to ${newStatus}`;
      }
      return `Case #${caseNum} updated by ${actor}`;
    }
    case 'CASE_RESOLVED': {
      const caseNum = payload.caseNumber || payload.case_number || '';
      return `Case #${caseNum} resolved by ${actor}`;
    }
    default:
      return `${eventType} by ${actor}`;
  }
}

// Build action URL for an event (navigable from frontend)
function buildActionUrl(
  eventType: string,
  payload: Record<string, unknown>
): string | undefined {
  const incidentId = payload.incidentId || payload.incident_id;
  const caseId = payload.caseId || payload.case_id;

  if (incidentId && (
    eventType === 'INCIDENT_CREATED' ||
    eventType === 'INCIDENT_APPROVED' ||
    eventType === 'INCIDENT_REJECTED'
  )) {
    return `/admin/incidents/${String(incidentId)}`;
  }

  if (caseId && (
    eventType === 'CASE_CREATED' ||
    eventType === 'CASE_UPDATED' ||
    eventType === 'CASE_RESOLVED'
  )) {
    return `/admin/cases/${String(caseId)}`;
  }

  return undefined;
}

export class WhsDashboardService {
  constructor(
    private readonly companyId: string,
    private readonly timezone: string = 'Asia/Manila'
  ) {}

  async getWhsDashboard(personId: string) {
    // Start of current month in company timezone
    const nowInTz = DateTime.now().setZone(this.timezone);
    const startOfMonth = nowInTz.startOf('month').toJSDate();
    const startOfNextMonth = nowInTz.plus({ months: 1 }).startOf('month').toJSDate();

    // Run all independent queries in parallel
    const [
      pendingIncidentsCount,
      myCasesCount,
      totalOpenCasesCount,
      resolvedThisMonthCount,
      caseStatusGroups,
      pendingIncidents,
      recentEvents,
    ] = await Promise.all([
      // 1. Pending incidents count
      prisma.incident.count({
        where: {
          company_id: this.companyId,
          status: 'PENDING',
        },
      }),

      // 2. My open cases (OPEN + INVESTIGATING, assigned to current user)
      prisma.case.count({
        where: {
          company_id: this.companyId,
          assigned_to: personId,
          status: { in: ['OPEN', 'INVESTIGATING'] },
        },
      }),

      // 3. Total open cases (OPEN + INVESTIGATING, all officers)
      prisma.case.count({
        where: {
          company_id: this.companyId,
          status: { in: ['OPEN', 'INVESTIGATING'] },
        },
      }),

      // 4. Resolved this month
      prisma.case.count({
        where: {
          company_id: this.companyId,
          resolved_at: {
            gte: startOfMonth,
            lt: startOfNextMonth,
          },
        },
      }),

      // 5. Cases grouped by status
      prisma.case.groupBy({
        by: ['status'],
        where: { company_id: this.companyId },
        _count: { id: true },
      }),

      // 6. Top 5 pending incidents (severity DESC via enum definition order, then oldest first)
      prisma.incident.findMany({
        where: {
          company_id: this.companyId,
          status: 'PENDING',
        },
        select: {
          id: true,
          incident_number: true,
          title: true,
          incident_type: true,
          severity: true,
          created_at: true,
          reporter: {
            select: { first_name: true, last_name: true },
          },
        },
        orderBy: [
          { severity: 'desc' },
          { created_at: 'asc' },
        ],
        take: 5,
      }),

      // 7. Recent activity (last 10 incident/case events)
      prisma.event.findMany({
        where: {
          company_id: this.companyId,
          event_type: {
            in: [
              'INCIDENT_CREATED',
              'INCIDENT_APPROVED',
              'INCIDENT_REJECTED',
              'CASE_CREATED',
              'CASE_UPDATED',
              'CASE_RESOLVED',
            ],
          },
        },
        select: {
          id: true,
          event_type: true,
          payload: true,
          created_at: true,
          person: {
            select: { first_name: true, last_name: true },
          },
        },
        orderBy: { created_at: 'desc' },
        take: 10,
      }),
    ]);

    // Build cases by status
    const casesByStatus = {
      open: 0,
      investigating: 0,
      resolved: 0,
      closed: 0,
    };
    for (const group of caseStatusGroups) {
      const key = group.status.toLowerCase() as keyof typeof casesByStatus;
      if (key in casesByStatus) {
        casesByStatus[key] = group._count.id;
      }
    }

    // Map pending incidents (already sorted by DB: severity DESC, created_at ASC)
    const sortedPending = pendingIncidents.map((incident) => ({
      id: incident.id,
      incidentNumber: incident.incident_number,
      title: incident.title,
      reporterName: `${incident.reporter.first_name} ${incident.reporter.last_name}`,
      incidentType: incident.incident_type,
      severity: incident.severity,
      createdAt: incident.created_at.toISOString(),
    }));

    // Format recent activity events
    const recentActivity = recentEvents.map((event) => {
      const personName = event.person
        ? `${event.person.first_name} ${event.person.last_name}`
        : null;
      const payload = (event.payload as Record<string, unknown>) || {};

      return {
        id: event.id,
        type: event.event_type,
        message: formatEventMessage(event.event_type, payload, personName),
        timestamp: event.created_at.toISOString(),
        actionUrl: buildActionUrl(event.event_type, payload),
      };
    });

    return {
      pendingIncidentsCount,
      myCasesCount,
      totalOpenCasesCount,
      resolvedThisMonthCount,
      casesByStatus,
      pendingIncidents: sortedPending,
      recentActivity,
    };
  }
}
