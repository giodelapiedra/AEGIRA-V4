import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import type { LucideIcon } from 'lucide-react';
import {
  Eye,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  LayoutList,
  Clock,
  X,
} from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/PageLoader';
import { TableSearch } from '@/components/common/TableSearch';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IncidentStatusBadge } from '../components/IncidentStatusBadge';
import { SeverityBadge } from '../components/SeverityBadge';
import { RejectionDialog } from '../components/RejectionDialog';
import { useIncidents } from '../hooks/useIncidents';
import { useApproveIncident } from '../hooks/useApproveIncident';
import { useToast } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { ROUTES } from '@/config/routes.config';
import { buildRoute } from '@/lib/utils/route.utils';
import { formatDate } from '@/lib/utils/date.utils';
import { formatIncidentNumber, formatIncidentType } from '@/lib/utils/format.utils';
import { cn } from '@/lib/utils/cn';
import type {
  IncidentListItem,
  IncidentStatus,
  IncidentSeverity,
  IncidentType,
} from '@/types/incident.types';

// --- Status filter cards config ---

type StatusFilter = 'ALL' | IncidentStatus;

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
    label: 'All Incidents',
    icon: LayoutList,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10',
    activeStyle: 'ring-primary/20 border-primary/40',
  },
  {
    value: 'PENDING',
    label: 'Pending Review',
    icon: Clock,
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-500/10',
    activeStyle: 'ring-amber-500/20 border-amber-500/40',
  },
  {
    value: 'APPROVED',
    label: 'Approved',
    icon: CheckCircle2,
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-500/10',
    activeStyle: 'ring-emerald-500/20 border-emerald-500/40',
  },
  {
    value: 'REJECTED',
    label: 'Rejected',
    icon: XCircle,
    iconColor: 'text-red-500',
    iconBg: 'bg-red-500/10',
    activeStyle: 'ring-red-500/20 border-red-500/40',
  },
];

const EMPTY_MESSAGES: Record<StatusFilter, string> = {
  ALL: 'No incidents have been reported yet.',
  PENDING: 'No incidents pending review.',
  APPROVED: 'No approved incidents found.',
  REJECTED: 'No rejected incidents found.',
};

// --- Severity / Type filter options ---

const SEVERITY_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Severities' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
] as const;

const TYPE_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Types' },
  { value: 'PHYSICAL_INJURY', label: 'Physical Injury' },
  { value: 'ILLNESS_SICKNESS', label: 'Illness / Sickness' },
  { value: 'MENTAL_HEALTH', label: 'Mental Health' },
  { value: 'MEDICAL_EMERGENCY', label: 'Medical Emergency' },
  { value: 'HEALTH_SAFETY_CONCERN', label: 'Health & Safety' },
  { value: 'OTHER', label: 'Other' },
] as const;

// --- Table columns ---

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
      <span className="font-medium max-w-[180px] truncate block">
        {row.original.title}
      </span>
    ),
  },
  {
    accessorKey: 'reporterName',
    header: 'Reporter',
  },
  {
    accessorKey: 'teamName',
    header: 'Team',
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
      return (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions incident={row.original} />
        </div>
      );
    },
  },
];

// --- Row actions (approve / reject / view) ---

function RowActions({ incident }: { incident: IncidentListItem }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isWhs = user?.role === 'WHS';
  const approveIncident = useApproveIncident();
  const { toast } = useToast();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const handleApprove = async () => {
    try {
      await approveIncident.mutateAsync(incident.id);
      toast({
        variant: 'success',
        title: 'Incident approved',
        description: 'A case has been created.',
      });
      setApproveOpen(false);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to approve',
        description: err instanceof Error ? err.message : 'Something went wrong.',
      });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => navigate(buildRoute(ROUTES.WHS_INCIDENT_DETAIL, { id: incident.id }))}
          >
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </DropdownMenuItem>
          {isWhs && incident.status === 'PENDING' && (
            <>
              <DropdownMenuItem onClick={() => setApproveOpen(true)}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRejectOpen(true)}>
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Approve Incident"
        description="This will approve the incident and create a new case. Are you sure?"
        confirmLabel="Approve"
        onConfirm={handleApprove}
        isLoading={approveIncident.isPending}
      />

      <RejectionDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        incidentId={incident.id}
      />
    </>
  );
}

// --- Main page component ---

export function AdminIncidentsPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const { data, isLoading, isFetching, error } = useIncidents({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    severity:
      severityFilter === 'ALL' ? undefined : (severityFilter as IncidentSeverity),
    type: typeFilter === 'ALL' ? undefined : (typeFilter as IncidentType),
    search: search || undefined,
  });

  const statusCounts = data?.statusCounts ?? {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
  };
  const totalCount =
    statusCounts.PENDING + statusCounts.APPROVED + statusCounts.REJECTED;

  const hasActiveFilters =
    severityFilter !== 'ALL' || typeFilter !== 'ALL' || search !== '';

  const handleStatusChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setSeverityFilter('ALL');
    setTypeFilter('ALL');
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
    setTypeFilter('ALL');
    setSearch('');
    setSearchInput('');
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleRowClick = (row: IncidentListItem) => {
    navigate(buildRoute(ROUTES.WHS_INCIDENT_DETAIL, { id: row.id }));
  };

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <div className="space-y-6">
        <PageHeader
          title="Incident Management"
          description="Review and manage workplace incident reports"
        />

        {/* Status filter cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STATUS_FILTERS.map((filter) => {
            const count =
              filter.value === 'ALL'
                ? totalCount
                : statusCounts[filter.value as IncidentStatus];
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
                {filter.value === 'PENDING' && count > 0 && (
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
            placeholder="Search by title or reporter..."
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
          <Select
            value={typeFilter}
            onValueChange={(value) => {
              setTypeFilter(value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="sm:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_FILTER_OPTIONS.map((opt) => (
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
