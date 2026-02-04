import { useState, useDeferredValue } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/PageLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CaseStatusBadge } from '../components/CaseStatusBadge';
import { SeverityBadge } from '../components/SeverityBadge';
import { useCases } from '../hooks/useCases';
import { formatDate } from '@/lib/utils/date.utils';
import { formatCaseNumber } from '@/lib/utils/format.utils';
import type { Case, CaseStatus } from '@/types/incident.types';

const columns: ColumnDef<Case>[] = [
  {
    accessorKey: 'caseNumber',
    header: 'Case #',
    cell: ({ row }) =>
      formatCaseNumber(row.original.caseNumber, row.original.createdAt),
  },
  {
    accessorKey: 'incident.title',
    header: 'Incident Title',
    cell: ({ row }) => (
      <span className="font-medium max-w-[200px] truncate block">
        {row.original.incident.title}
      </span>
    ),
  },
  {
    accessorKey: 'incident.reporterName',
    header: 'Reporter',
    cell: ({ row }) => row.original.incident.reporterName,
  },
  {
    accessorKey: 'incident.severity',
    header: 'Severity',
    cell: ({ row }) => (
      <SeverityBadge severity={row.original.incident.severity} />
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <CaseStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'assigneeName',
    header: 'Assigned To',
    cell: ({ row }) => row.original.assigneeName ?? 'Unassigned',
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
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
          onClick={() => navigate(`/admin/cases/${row.original.id}`)}
        >
          <Eye className="h-4 w-4 mr-1" />
          View
        </Button>
      );
    },
  },
];

type StatusTab = 'ALL' | CaseStatus;

export function AdminCasesPage() {
  const [statusTab, setStatusTab] = useState<StatusTab>('ALL');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const { data, isLoading, error } = useCases({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    status: statusTab === 'ALL' ? undefined : statusTab,
    search: deferredSearch || undefined,
  });

  const handleTabChange = (value: string) => {
    setStatusTab(value as StatusTab);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const statusCounts = data?.statusCounts ?? {
    OPEN: 0,
    INVESTIGATING: 0,
    RESOLVED: 0,
    CLOSED: 0,
  };
  const totalCount =
    statusCounts.OPEN +
    statusCounts.INVESTIGATING +
    statusCounts.RESOLVED +
    statusCounts.CLOSED;

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <div className="space-y-6">
        <PageHeader
          title="Case Management"
          description="Manage and track cases created from approved incidents"
        />

        <Tabs value={statusTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="ALL" className="gap-1.5">
              All
              <span className="text-xs text-muted-foreground">({totalCount})</span>
            </TabsTrigger>
            <TabsTrigger value="OPEN" className="gap-1.5">
              Open
              <span className="text-xs text-muted-foreground">
                ({statusCounts.OPEN})
              </span>
            </TabsTrigger>
            <TabsTrigger value="INVESTIGATING" className="gap-1.5">
              Investigating
              <span className="text-xs text-muted-foreground">
                ({statusCounts.INVESTIGATING})
              </span>
            </TabsTrigger>
            <TabsTrigger value="RESOLVED" className="gap-1.5">
              Resolved
              <span className="text-xs text-muted-foreground">
                ({statusCounts.RESOLVED})
              </span>
            </TabsTrigger>
            <TabsTrigger value="CLOSED" className="gap-1.5">
              Closed
              <span className="text-xs text-muted-foreground">
                ({statusCounts.CLOSED})
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Input
          placeholder="Search by incident title or reporter..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPagination((prev) => ({ ...prev, pageIndex: 0 }));
          }}
          className="max-w-xs"
        />

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          pageCount={data?.pagination?.totalPages}
          pagination={pagination}
          onPaginationChange={setPagination}
          totalCount={data?.pagination?.total}
          emptyMessage="No cases found."
        />
      </div>
    </PageLoader>
  );
}
