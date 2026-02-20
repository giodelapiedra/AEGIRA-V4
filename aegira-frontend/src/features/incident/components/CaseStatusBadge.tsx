import { Badge } from '@/components/ui/badge';
import { SEMANTIC_STATUS } from '@/lib/constants';
import type { CaseStatus } from '@/types/incident.types';
import type { BadgeProps } from '@/components/ui/badge';

const STATUS_CONFIG: Record<
  CaseStatus,
  { label: string; variant: BadgeProps['variant'] }
> = {
  OPEN: SEMANTIC_STATUS.CASE_STATUS.OPEN,
  INVESTIGATING: SEMANTIC_STATUS.CASE_STATUS.INVESTIGATING,
  RESOLVED: SEMANTIC_STATUS.CASE_STATUS.RESOLVED,
  CLOSED: SEMANTIC_STATUS.CASE_STATUS.CLOSED,
};

interface CaseStatusBadgeProps {
  status: CaseStatus;
}

export function CaseStatusBadge({ status }: CaseStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
