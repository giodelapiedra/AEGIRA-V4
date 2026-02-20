import { Badge } from '@/components/ui/badge';
import { SEMANTIC_STATUS } from '@/lib/constants';
import type { IncidentStatus } from '@/types/incident.types';
import type { BadgeProps } from '@/components/ui/badge';

const STATUS_CONFIG: Record<
  IncidentStatus,
  { label: string; variant: BadgeProps['variant'] }
> = {
  PENDING: SEMANTIC_STATUS.INCIDENT_STATUS.PENDING,
  APPROVED: SEMANTIC_STATUS.INCIDENT_STATUS.APPROVED,
  REJECTED: SEMANTIC_STATUS.INCIDENT_STATUS.REJECTED,
};

interface IncidentStatusBadgeProps {
  status: IncidentStatus;
}

export function IncidentStatusBadge({ status }: IncidentStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
