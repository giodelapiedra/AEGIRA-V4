import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import type { CaseStatus } from '@/types/incident.types';

const STATUS_CONFIG: Record<CaseStatus, { label: string; className: string }> = {
  OPEN: {
    label: 'Open',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  INVESTIGATING: {
    label: 'Investigating',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  RESOLVED: {
    label: 'Resolved',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  CLOSED: {
    label: 'Closed',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

interface CaseStatusBadgeProps {
  status: CaseStatus;
}

export function CaseStatusBadge({ status }: CaseStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={cn(config.className)}>
      {config.label}
    </Badge>
  );
}
