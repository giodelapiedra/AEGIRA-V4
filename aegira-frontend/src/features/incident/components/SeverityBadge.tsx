import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import type { IncidentSeverity } from '@/types/incident.types';

const SEVERITY_CONFIG: Record<IncidentSeverity, { label: string; className: string }> = {
  LOW: {
    label: 'Low',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  MEDIUM: {
    label: 'Medium',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  HIGH: {
    label: 'High',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  CRITICAL: {
    label: 'Critical',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
};

interface SeverityBadgeProps {
  severity: IncidentSeverity;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <Badge variant="outline" className={cn(config.className)}>
      {config.label}
    </Badge>
  );
}
