import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import type { IncidentStatus } from '@/types/incident.types';

const STATUS_CONFIG: Record<IncidentStatus, { label: string; className: string }> = {
  PENDING: {
    label: 'Pending',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  APPROVED: {
    label: 'Approved',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  REJECTED: {
    label: 'Rejected',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
};

interface IncidentStatusBadgeProps {
  status: IncidentStatus;
}

export function IncidentStatusBadge({ status }: IncidentStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={cn(config.className)}>
      {config.label}
    </Badge>
  );
}
