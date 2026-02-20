import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import type { LucideIcon } from 'lucide-react';
import {
  Eye,
  FolderOpen,
  Search as SearchIcon,
  CheckCheck,
  Lock,
  LayoutList,
  X,
} from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/PageLoader';
import { TableSearch } from '@/components/common/TableSearch';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CaseStatusBadge } from '../components/CaseStatusBadge';
import { SeverityBadge } from '../components/SeverityBadge';
import { useCases } from '../hooks/useCases';
import { formatDate } from '@/lib/utils/date.utils';
import { formatCaseNumber } from '@/lib/utils/format.utils';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/config/routes.config';
import { buildRoute } from '@/lib/utils/route.utils';
import type { CaseListItem, CaseStatus, IncidentSeverity } from '@/types/incident.types';

// --- Status filter cards config ---

type StatusFilter = 'ALL' | CaseStatus;

interface StatusFilterOption {
  value: StatusFilter;
  label: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  activeStyle: string;
}

const STATUS_FILTERS: StatusFilterOption[] = [
  {
    value: 'ALL',
    label: 'All Cases',
    icon: LayoutList,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10',
    activeStyle: 'ring-primary/20 border-primary/40',
  },
  {
    value: 'OPEN',
    label: 'Open',
    icon: FolderOpen,
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-500/10',
    activeStyle: 'ring-amber-500/20 border-amber-500/40',
  },
  {
    value: 'INVESTIGATING',
    label: 'Investigating',
    icon: SearchIcon,
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-500/10',
    activeStyle: 'ring-blue-500/20 border-blue-500/40',
  },
  {
    value: 'RESOLVED',
    label: 'Resolved',
    icon: CheckCheck,
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-500/10',
    activeStyle: 'ring-emerald-500/20 border-emerald-500/40',
  },
  {
    value: 'CLOSED',
    label: 'Closed',
    icon: Lock,
    iconColor: 'text-slate-500',
    iconBg: 'bg-slate-500/10',
    activeStyle: 'ring-slate-500/20 border-slate-500/40',
  },
];

const EMPTY_MESSAGES: Record<StatusFilter, string> = {
  ALL: 'No cases have been created yet.',
  OPEN: 'No open cases. All cases are being handled.',
  INVESTIGATING: 'No cases currently under investigation.',
  RESOLVED: 'No resolved cases yet.',
  CLOSED: 'No closed cases.',
};

const SEVERITY_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Severities' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
] as const;

// --- Table columns ---

const columns: ColumnDef<CaseListItem>[] = [
  {
    accessorKey: 'caseNumber',
    header: 'Case #',
    cell: ({ row }) =>
      formatCaseNumber(row.original.caseNumber, row.original.createdAt),
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
    meta: {
      className: 'hidden sm:table-cell',
    },
  },
  {
    accessorKey: 'assigneeName',
    header: 'Assigned To',
    cell: ({ row }) => row.original.assigneeName ?? 'Unassigned',
    meta: {
      className: 'hidden lg:table-cell',
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => formatDate(row.original.createdAt),
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
          onClick={(e) => {
            e.stopPropagation();
            navigate(buildRoute(ROUTES.WHS_CASE_DETAIL, { id: row.original.id }));
          }}
          aria-label="View case details"
        >
          <Eye className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">View</span>
        </Button>
      );
    },
  },
];

// --- Main page component ---

export function AdminCasesPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const { data, isLoading, isFetching, error } = useCases({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    severity:
      severityFilter === 'ALL' ? undefined : (severityFilter as IncidentSeverity),
    search: search || undefined,
  });

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

  const hasActiveFilters =
    severityFilter !== 'ALL' || search !== '';

  const handleStatusChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setSeverityFilter('ALL');
    setSearch('');
    setSearchInput('');
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const clearFilters = () => {
    setSeverityFilter('ALL');
    setSearch('');
    setSearchInput('');
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleRowClick = (row: CaseListItem) => {
    navigate(buildRoute(ROUTES.WHS_CASE_DETAIL, { id: row.id }));
  };

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <div className="space-y-6">
        <PageHeader
          title="Case Management"
          description="Manage and track cases created from approved incidents"
        />

        {/* Status filter cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {STATUS_FILTERS.map((filter) => {
            const count =
              filter.value === 'ALL'
                ? totalCount
                : statusCounts[filter.value as CaseStatus];
            const isActive = statusFilter === filter.value;
            const Icon = filter.icon;

            return (
              <button
                key={filter.value}
                onClick={() => handleStatusChange(filter.value)}
                className={cn(
                  'relative flex items-center gap-3 rounded-lg border bg-card p-3 text-left transition-all',
                  isActive
                    ? `ring-2 shadow-sm ${filter.activeStyle}`
                    : 'hover:bg-accent/50'
                )}
              >
                <div
                  className={cn(
                    'flex shrink-0 items-center justify-center rounded-lg p-2',
                    filter.iconBg
                  )}
                >
                  <Icon className={cn('h-4 w-4', filter.iconColor)} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold tabular-nums leading-none">
                    {count}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {filter.label}
                  </p>
                </div>
                {filter.value === 'OPEN' && count > 0 && (
                  <span className="absolute right-2 top-2 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <TableSearch
            placeholder="Search by incident title or reporter..."
            value={searchInput}
            onChange={setSearchInput}
            onSearch={handleSearch}
          />
          <Select
            value={severityFilter}
            onValueChange={(value) => {
              setSeverityFilter(value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEVERITY_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 gap-1.5 text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </Button>
          )}
        </div>

        {/* Data table with loading opacity for refetches */}
        <div
          className={cn(
            'transition-opacity duration-150',
            isFetching && !isLoading && 'opacity-60'
          )}
        >
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            pageCount={data?.pagination?.totalPages}
            pagination={pagination}
            onPaginationChange={setPagination}
            totalCount={data?.pagination?.total}
            emptyMessage={EMPTY_MESSAGES[statusFilter]}
            onRowClick={handleRowClick}
          />
        </div>
      </div>
    </PageLoader>
  );
}
