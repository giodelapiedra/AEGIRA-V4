import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageLoader } from '@/components/common/PageLoader';
import { StatCard } from '@/features/dashboard/components/StatCard';
import { AlertCircle, Clock, CheckCircle2, FileX } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { useToast } from '@/lib/hooks/use-toast';

type MissedCheckInStatus = 'OPEN' | 'INVESTIGATING' | 'EXCUSED' | 'RESOLVED';

interface MissedCheckIn {
  id: string;
  workerId: string;
  workerName: string;
  workerEmail: string;
  teamName: string;
  date: string;
  scheduleWindow: string;
  status: MissedCheckInStatus;
  notes: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  reason: string;
  createdAt: string;
}

interface MissedCheckInsResponse {
  items: MissedCheckIn[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  statusCounts: Partial<Record<MissedCheckInStatus, number>>;
}

const STATUS_OPTIONS: { value: MissedCheckInStatus; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'INVESTIGATING', label: 'Investigating' },
  { value: 'EXCUSED', label: 'Excused' },
  { value: 'RESOLVED', label: 'Resolved' },
];

const getStatusBadge = (status: MissedCheckInStatus) => {
  switch (status) {
    case 'OPEN':
      return <Badge variant="destructive">Open</Badge>;
    case 'INVESTIGATING':
      return <Badge variant="warning">Investigating</Badge>;
    case 'EXCUSED':
      return <Badge variant="outline">Excused</Badge>;
    case 'RESOLVED':
      return <Badge variant="success">Resolved</Badge>;
  }
};

function StatusUpdateCell({
  record,
  onUpdate,
}: {
  record: MissedCheckIn;
  onUpdate: (id: string, status: MissedCheckInStatus) => void;
}) {
  // Terminal statuses cannot be changed
  if (record.status === 'EXCUSED' || record.status === 'RESOLVED') {
    return getStatusBadge(record.status);
  }

  const allowedStatuses =
    record.status === 'OPEN'
      ? ['INVESTIGATING', 'EXCUSED', 'RESOLVED']
      : ['EXCUSED', 'RESOLVED'];

  return (
    <Select
      value={record.status}
      onValueChange={(value) => onUpdate(record.id, value as MissedCheckInStatus)}
    >
      <SelectTrigger className="w-[140px] h-8">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={record.status} disabled>
          {STATUS_OPTIONS.find((s) => s.value === record.status)?.label}
        </SelectItem>
        {allowedStatuses.map((s) => (
          <SelectItem key={s} value={s}>
            {STATUS_OPTIONS.find((opt) => opt.value === s)?.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const getColumns = (
  onStatusUpdate: (id: string, status: MissedCheckInStatus) => void
): ColumnDef<MissedCheckIn>[] => [
  {
    accessorKey: 'workerName',
    header: ({ column }) => <SortableHeader column={column}>Worker</SortableHeader>,
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.workerName}</p>
        <p className="text-sm text-muted-foreground">{row.original.workerEmail}</p>
      </div>
    ),
  },
  {
    accessorKey: 'teamName',
    header: 'Team',
  },
  {
    accessorKey: 'date',
    header: ({ column }) => <SortableHeader column={column}>Date</SortableHeader>,
    cell: ({ row }) => {
      const date = row.original.date;
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    },
  },
  {
    accessorKey: 'scheduleWindow',
    header: 'Schedule',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <StatusUpdateCell record={row.original} onUpdate={onStatusUpdate} />
    ),
  },
  {
    accessorKey: 'notes',
    header: 'Notes',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.notes || '-'}
      </span>
    ),
  },
];

export function MissedCheckInsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const { data, isLoading, error } = useQuery({
    queryKey: [
      'team',
      'missed-check-ins',
      pagination.pageIndex,
      pagination.pageSize,
      statusFilter,
    ],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(pagination.pageIndex + 1),
        limit: String(pagination.pageSize),
      });
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      return apiClient.get<MissedCheckInsResponse>(
        `${ENDPOINTS.TEAM_MANAGEMENT.MISSED_CHECK_INS}?${params.toString()}`
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: MissedCheckInStatus }) =>
      apiClient.patch(ENDPOINTS.TEAM_MANAGEMENT.UPDATE_MISSED_CHECK_IN(id), { status }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team', 'missed-check-ins'] });
      toast({ variant: 'success', title: 'Status updated', description: `Record marked as ${variables.status.toLowerCase()}.` });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Update failed', description: error?.message || 'Something went wrong.' });
    },
  });

  const handleStatusUpdate = (id: string, status: MissedCheckInStatus) => {
    updateMutation.mutate({ id, status });
  };

  const items = data?.items || [];
  const totalPages = data?.pagination?.totalPages || 0;
  const counts = data?.statusCounts ?? {};
  const openCount = counts.OPEN ?? 0;
  const investigatingCount = counts.INVESTIGATING ?? 0;
  const excusedCount = counts.EXCUSED ?? 0;
  const resolvedCount = counts.RESOLVED ?? 0;
  const totalCount = openCount + investigatingCount + excusedCount + resolvedCount;

  const columns = getColumns(handleStatusUpdate);

  // Reset to page 1 when filter changes
  const handleFilterChange = (value: string) => {
    setStatusFilter(value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <div className="space-y-6">
        <PageHeader
          title="Missed Check-ins"
          description="Review workers who missed their daily check-ins"
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Records"
            value={totalCount}
            icon={<FileX className="h-4 w-4" />}
            iconBgColor="blue"
          />
          <StatCard
            title="Open"
            value={openCount}
            icon={<AlertCircle className="h-4 w-4" />}
            iconBgColor="orange"
          />
          <StatCard
            title="Investigating"
            value={investigatingCount}
            icon={<Clock className="h-4 w-4" />}
            iconBgColor="purple"
          />
          <StatCard
            title="Resolved / Excused"
            value={resolvedCount + excusedCount}
            icon={<CheckCircle2 className="h-4 w-4" />}
            iconBgColor="green"
          />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Missed Check-ins
              </CardTitle>
              <Select value={statusFilter} onValueChange={handleFilterChange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={items}
              isLoading={isLoading}
              pageCount={totalPages}
              pagination={pagination}
              onPaginationChange={setPagination}
              totalCount={data?.pagination?.total || 0}
              emptyMessage="No missed check-ins found. Great job!"
            />
          </CardContent>
        </Card>
      </div>
    </PageLoader>
  );
}
