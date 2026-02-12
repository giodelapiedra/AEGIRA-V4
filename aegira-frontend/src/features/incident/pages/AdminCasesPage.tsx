import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/PageLoader';
import { TableSearch } from '@/components/common/TableSearch';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CaseStatusBadge } from '../components/CaseStatusBadge';
import { SeverityBadge } from '../components/SeverityBadge';
import { useCases } from '../hooks/useCases';
import { formatDate } from '@/lib/utils/date.utils';
import { formatCaseNumber } from '@/lib/utils/format.utils';
import { ROUTES } from '@/config/routes.config';
import type { Case, CaseStatus } from '@/types/incident.types';

const columns: ColumnDef<Case>[] = [
  {
    accessorKey: 'caseNumber',
    header: 'Case #',
    cell: ({ row }) =>
      formatCaseNumber(row.original.caseNumber, row.original.createdAt),
    // Hide on mobile (< 1024px)
    meta: {
      className: 'hidden lg:table-cell',
    },
  },
  {
    accessorKey: 'incident.title',
    header: 'Incident Title',
    cell: ({ row }) => (
      <div>
        <span className="font-medium line-clamp-2">
          {row.original.incident.title}
        </span>
        {/* Show reporter on mobile (when Reporter column is hidden) */}
        <div className="text-xs text-muted-foreground mt-0.5 md:hidden">
          {row.original.incident.reporterName}
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'incident.reporterName',
    header: 'Reporter',
    cell: ({ row }) => row.original.incident.reporterName,
    // Hide on mobile, show on medium+ (≥ 768px)
    meta: {
      className: 'hidden md:table-cell',
    },
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
    // Hide on small mobile (< 640px)
    meta: {
      className: 'hidden sm:table-cell',
    },
  },
  {
    accessorKey: 'assigneeName',
    header: 'Assigned To',
    cell: ({ row }) => row.original.assigneeName ?? 'Unassigned',
    // Hide on mobile (< 1024px)
    meta: {
      className: 'hidden lg:table-cell',
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => formatDate(row.original.createdAt),
    // Hide on mobile (< 768px)
    meta: {
      className: 'hidden md:table-cell',
    },
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
          onClick={() => navigate(ROUTES.ADMIN_CASE_DETAIL.replace(':id', row.original.id))}
          aria-label="View case details"
        >
          <Eye className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">View</span>
        </Button>
      );
    },
  },
];

type StatusTab = 'ALL' | CaseStatus;

export function AdminCasesPage() {
  const [statusTab, setStatusTab] = useState<StatusTab>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const { data, isLoading, error } = useCases({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    status: statusTab === 'ALL' ? undefined : statusTab,
    search: search || undefined,
  });

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

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
          <div className="overflow-x-auto pb-2">
            <TabsList className="inline-flex w-auto min-w-full sm:min-w-0">
              <TabsTrigger value="ALL" className="gap-1.5 whitespace-nowrap">
                All
                <span className="text-xs text-muted-foreground">({totalCount})</span>
              </TabsTrigger>
              <TabsTrigger value="OPEN" className="gap-1.5 whitespace-nowrap">
                Open
                <span className="text-xs text-muted-foreground">
                  ({statusCounts.OPEN})
                </span>
              </TabsTrigger>
              <TabsTrigger value="INVESTIGATING" className="gap-1.5 whitespace-nowrap">
                Investigating
                <span className="text-xs text-muted-foreground">
                  ({statusCounts.INVESTIGATING})
                </span>
              </TabsTrigger>
              <TabsTrigger value="RESOLVED" className="gap-1.5 whitespace-nowrap">
                Resolved
                <span className="text-xs text-muted-foreground">
                  ({statusCounts.RESOLVED})
                </span>
              </TabsTrigger>
              <TabsTrigger value="CLOSED" className="gap-1.5 whitespace-nowrap">
                Closed
                <span className="text-xs text-muted-foreground">
                  ({statusCounts.CLOSED})
                </span>
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>

        <TableSearch
          placeholder="Search by incident title or reporter..."
          value={searchInput}
          onChange={setSearchInput}
          onSearch={handleSearch}
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
