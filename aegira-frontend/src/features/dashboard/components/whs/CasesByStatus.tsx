import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CaseStatusBadge } from '@/features/incident/components/CaseStatusBadge';
import { ROUTES } from '@/config/routes.config';
import type { CaseStatus } from '@/types/incident.types';

interface CasesByStatusProps {
  casesByStatus: {
    open: number;
    investigating: number;
    resolved: number;
    closed: number;
  };
}

const STATUS_ROWS: { key: keyof CasesByStatusProps['casesByStatus']; status: CaseStatus }[] = [
  { key: 'open', status: 'OPEN' },
  { key: 'investigating', status: 'INVESTIGATING' },
  { key: 'resolved', status: 'RESOLVED' },
  { key: 'closed', status: 'CLOSED' },
];

export function CasesByStatus({ casesByStatus }: CasesByStatusProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cases Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {STATUS_ROWS.map(({ key, status }) => (
          <button
            key={key}
            type="button"
            className="flex w-full items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
            onClick={() => navigate(`${ROUTES.ADMIN_CASES}?status=${status}`)}
          >
            <CaseStatusBadge status={status} />
            <span className="text-2xl font-bold tabular-nums">
              {casesByStatus[key]}
            </span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
