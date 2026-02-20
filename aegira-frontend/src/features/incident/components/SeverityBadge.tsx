import { Badge } from '@/components/ui/badge';
import { SEMANTIC_STATUS } from '@/lib/constants';
import type { IncidentSeverity } from '@/types/incident.types';
import type { BadgeProps } from '@/components/ui/badge';

const SEVERITY_CONFIG: Record<
  IncidentSeverity,
  { label: string; variant: BadgeProps['variant'] }
> = {
  LOW: SEMANTIC_STATUS.INCIDENT_SEVERITY.LOW,
  MEDIUM: SEMANTIC_STATUS.INCIDENT_SEVERITY.MEDIUM,
  HIGH: SEMANTIC_STATUS.INCIDENT_SEVERITY.HIGH,
  CRITICAL: SEMANTIC_STATUS.INCIDENT_SEVERITY.CRITICAL,
};

interface SeverityBadgeProps {
  severity: IncidentSeverity;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const config = SEVERITY_CONFIG[severity];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
