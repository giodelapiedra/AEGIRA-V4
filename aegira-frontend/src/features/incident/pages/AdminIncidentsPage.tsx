import { useState, useDeferredValue } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Eye, MoreHorizontal, CheckCircle2, XCircle } from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/PageLoader';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
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
import { formatDate } from '@/lib/utils/date.utils';
import { formatIncidentNumber, formatIncidentType } from '@/lib/utils/format.utils';
import type {
  Incident,
  IncidentStatus,
  IncidentSeverity,
  IncidentType,
} from '@/types/incident.types';

const columns: ColumnDef<Incident>[] = [
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
      return <RowActions incident={row.original} />;
    },
  },
];

function RowActions({ incident }: { incident: Incident }) {
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
            onClick={() => navigate(`/admin/incidents/${incident.id}`)}
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

type StatusTab = 'ALL' | IncidentStatus;

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

export function AdminIncidentsPage() {
  const [statusTab, setStatusTab] = useState<StatusTab>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const { data, isLoading, error } = useIncidents({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    status: statusTab === 'ALL' ? undefined : statusTab,
    severity:
      severityFilter === 'ALL' ? undefined : (severityFilter as IncidentSeverity),
    type: typeFilter === 'ALL' ? undefined : (typeFilter as IncidentType),
    search: deferredSearch || undefined,
  });

  const handleTabChange = (value: string) => {
    setStatusTab(value as StatusTab);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const statusCounts = data?.statusCounts ?? {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
  };
  const totalCount =
    statusCounts.PENDING + statusCounts.APPROVED + statusCounts.REJECTED;

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <div className="space-y-6">
        <PageHeader
          title="Incident Management"
          description="Review and manage workplace incident reports"
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

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Search by title or reporter..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
            className="sm:max-w-xs"
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
        </div>

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
