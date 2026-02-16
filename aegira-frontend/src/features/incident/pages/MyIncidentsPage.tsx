import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Plus, Eye } from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/PageLoader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IncidentStatusBadge } from '../components/IncidentStatusBadge';
import { SeverityBadge } from '../components/SeverityBadge';
import { useMyIncidents } from '../hooks/useMyIncidents';
import { formatDate } from '@/lib/utils/date.utils';
import { formatIncidentNumber, formatIncidentType } from '@/lib/utils/format.utils';
import { ROUTES } from '@/config/routes.config';
import { buildRoute } from '@/lib/utils/route.utils';
import type { IncidentListItem, IncidentStatus } from '@/types/incident.types';

const columns: ColumnDef<IncidentListItem>[] = [
  {
    accessorKey: 'incidentNumber',
    header: 'Incident #',
    cell: ({ row }) =>
      formatIncidentNumber(row.original.incidentNumber, row.original.createdAt),
  },
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => (
      <span className="font-medium max-w-[200px] truncate block">
        {row.original.title}
      </span>
    ),
  },
  {
    accessorKey: 'incidentType',
    header: 'Type',
    cell: ({ row }) => formatIncidentType(row.original.incidentType),
  },
  {
    accessorKey: 'severity',
    header: 'Severity',
    cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <IncidentStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'reviewerName',
    header: 'Reviewed By',
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.reviewerName ?? '-'}
      </span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Submitted',
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
  {
    id: 'actions',
    header: '',
    cell: function ActionsCell({ row }) {
      const navigate = useNavigate();
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(buildRoute(ROUTES.INCIDENT_DETAIL, { id: row.original.id }))}
        >
          <Eye className="h-4 w-4 mr-1" />
          View
        </Button>
      );
    },
  },
];

type StatusTab = 'ALL' | IncidentStatus;

export function MyIncidentsPage() {
  const navigate = useNavigate();
  const [statusTab, setStatusTab] = useState<StatusTab>('ALL');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const statusFilter = statusTab === 'ALL' ? undefined : statusTab;

  const { data, isLoading, error } = useMyIncidents(
    pagination.pageIndex + 1,
    pagination.pageSize,
    statusFilter
  );

  const handleTabChange = (value: string) => {
    setStatusTab(value as StatusTab);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const statusCounts = data?.statusCounts ?? { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  const totalCount =
    statusCounts.PENDING + statusCounts.APPROVED + statusCounts.REJECTED;

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <div className="space-y-6">
        <PageHeader
          title="My Incidents"
          description="View and track your incident reports"
          action={
            <Button onClick={() => navigate(ROUTES.REPORT_INCIDENT)}>
              <Plus className="h-4 w-4 mr-2" />
              Report Incident
            </Button>
          }
        />

        <Tabs value={statusTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="ALL" className="gap-1.5">
              All
              <span className="text-xs text-muted-foreground">({totalCount})</span>
            </TabsTrigger>
            <TabsTrigger value="PENDING" className="gap-1.5">
              Pending
              <span className="text-xs text-muted-foreground">
                ({statusCounts.PENDING})
              </span>
            </TabsTrigger>
            <TabsTrigger value="APPROVED" className="gap-1.5">
              Approved
              <span className="text-xs text-muted-foreground">
                ({statusCounts.APPROVED})
              </span>
            </TabsTrigger>
            <TabsTrigger value="REJECTED" className="gap-1.5">
              Rejected
              <span className="text-xs text-muted-foreground">
                ({statusCounts.REJECTED})
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          pageCount={data?.pagination?.totalPages}
          pagination={pagination}
          onPaginationChange={setPagination}
          totalCount={data?.pagination?.total}
          emptyMessage="No incidents found."
        />
      </div>
    </PageLoader>
  );
}
