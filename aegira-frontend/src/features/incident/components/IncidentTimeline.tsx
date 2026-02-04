import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FolderOpen,
  RefreshCw,
  CheckCheck,
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils/date.utils';
import type { IncidentEvent } from '@/types/incident.types';

const EVENT_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  INCIDENT_CREATED: {
    label: 'Incident reported',
    icon: <AlertTriangle className="h-4 w-4" />,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
  },
  INCIDENT_APPROVED: {
    label: 'Incident approved',
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: 'text-green-600 bg-green-50 border-green-200',
  },
  INCIDENT_REJECTED: {
    label: 'Incident not approved',
    icon: <XCircle className="h-4 w-4" />,
    color: 'text-red-600 bg-red-50 border-red-200',
  },
  CASE_CREATED: {
    label: 'Case created',
    icon: <FolderOpen className="h-4 w-4" />,
    color: 'text-purple-600 bg-purple-50 border-purple-200',
  },
  CASE_UPDATED: {
    label: 'Case updated',
    icon: <RefreshCw className="h-4 w-4" />,
    color: 'text-orange-600 bg-orange-50 border-orange-200',
  },
  CASE_RESOLVED: {
    label: 'Case resolved',
    icon: <CheckCheck className="h-4 w-4" />,
    color: 'text-green-600 bg-green-50 border-green-200',
  },
};

interface IncidentTimelineProps {
  events: IncidentEvent[];
}

export function IncidentTimeline({ events }: IncidentTimelineProps) {
  return (
    <div className="relative space-y-0">
      {events.map((event, index) => {
        const config = EVENT_CONFIG[event.eventType] ?? {
          label: event.eventType,
          icon: <RefreshCw className="h-4 w-4" />,
          color: 'text-gray-600 bg-gray-50 border-gray-200',
        };

        const isLast = index === events.length - 1;

        return (
          <div key={event.id} className="relative flex gap-4 pb-6">
            {/* Vertical line */}
            {!isLast && (
              <div className="absolute left-[17px] top-9 bottom-0 w-px bg-border" />
            )}

            {/* Icon */}
            <div
              className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${config.color}`}
            >
              {config.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-sm font-medium">{config.label}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
                {event.personName && <span>by {event.personName}</span>}
                <span>{formatDateTime(event.createdAt)}</span>
              </div>
              {/* Payload details */}
              {event.eventType === 'INCIDENT_REJECTED' &&
                !!event.payload?.rejectionReason && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Reason: {String(event.payload.rejectionReason)}
                  </p>
                )}
              {event.eventType === 'CASE_UPDATED' && !!event.payload?.status && (
                <p className="text-xs text-muted-foreground mt-1">
                  Status changed to {String(event.payload.status)}
                  {!!event.payload.previousStatus &&
                    ` (from ${String(event.payload.previousStatus)})`}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
