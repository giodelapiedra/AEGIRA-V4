import { useState } from 'react';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { AlertTriangle, AlertCircle, Clock, CheckCircle2, FileX, Eye, TrendingUp, TrendingDown, Calendar, Flame, Target } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageLoader } from '@/components/common/PageLoader';
import { StatCard } from '@/features/dashboard/components/StatCard';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/lib/hooks/use-toast';
import {
  useMissedCheckIns,
  useUpdateMissedCheckInStatus,
  type MissedCheckIn,
  type MissedCheckInStatus,
} from '../hooks/useMissedCheckIns';

const STATUS_OPTIONS: { value: MissedCheckInStatus; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'INVESTIGATING', label: 'Investigating' },
  { value: 'EXCUSED', label: 'Excused' },
  { value: 'RESOLVED', label: 'Resolved' },
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
  onStatusUpdate: (id: string, status: MissedCheckInStatus) => void,
  onView: (record: MissedCheckIn) => void
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
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onView(row.original)}
        title="View details"
      >
        <Eye className="h-4 w-4" />
      </Button>
    ),
  },
];

export function MissedCheckInsPage() {
  const { toast } = useToast();
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedRecord, setSelectedRecord] = useState<MissedCheckIn | null>(null);

  // Use extracted hooks
  const { data, isLoading, error } = useMissedCheckIns(
    pagination.pageIndex + 1,
    pagination.pageSize,
    statusFilter
  );

  const updateMutation = useUpdateMissedCheckInStatus();

  const handleStatusUpdate = async (id: string, status: MissedCheckInStatus) => {
    try {
      await updateMutation.mutateAsync({ id, status });
      toast({
        variant: 'success',
        title: 'Status updated',
        description: `Record marked as ${status.toLowerCase()}.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Something went wrong.',
      });
    }
  };

  const items = data?.items || [];
  const totalPages = data?.pagination?.totalPages || 0;
  const counts = data?.statusCounts ?? {};
  const openCount = counts.OPEN ?? 0;
  const investigatingCount = counts.INVESTIGATING ?? 0;
  const excusedCount = counts.EXCUSED ?? 0;
  const resolvedCount = counts.RESOLVED ?? 0;
  const totalCount = openCount + investigatingCount + excusedCount + resolvedCount;

  const columns = getColumns(handleStatusUpdate, setSelectedRecord);

  // Reset to page 1 when filter changes
  const handleFilterChange = (value: string) => {
    setStatusFilter(value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const snapshot = selectedRecord?.stateSnapshot;

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

      {/* State Snapshot Detail Sheet */}
      <Sheet open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Missed Check-in Details</SheetTitle>
            <SheetDescription>
              {selectedRecord?.workerName} - {selectedRecord && new Date(selectedRecord.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Basic Info */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Basic Info</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Team</p>
                  <p className="font-medium">{selectedRecord?.teamName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Schedule</p>
                  <p className="font-medium">{selectedRecord?.scheduleWindow}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Day</p>
                  <p className="font-medium">{snapshot?.dayOfWeek != null ? DAY_NAMES[snapshot.dayOfWeek] : '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <div className="mt-0.5">{selectedRecord && getStatusBadge(selectedRecord.status)}</div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Worker State at Time of Miss */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">State When Missed</h4>

              {snapshot ? (
                <div className="space-y-4">
                  {/* Streak & Readiness */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 rounded-md bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                        <Flame className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Streak Before</p>
                        <p className="font-semibold">
                          {snapshot.checkInStreakBefore != null ? `${snapshot.checkInStreakBefore} days` : <span className="text-muted-foreground font-normal text-xs">No data</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Avg Readiness</p>
                        <p className="font-semibold">
                          {snapshot.recentReadinessAvg != null ? `${snapshot.recentReadinessAvg.toFixed(1)}%` : <span className="text-muted-foreground font-normal text-xs">Insufficient data</span>}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Days since */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 rounded-md bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Days Since Last Check-in</p>
                        <p className="font-semibold">
                          {snapshot.daysSinceLastCheckIn != null ? snapshot.daysSinceLastCheckIn : <span className="text-muted-foreground font-normal text-xs">No prior check-in</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 rounded-md bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                        <AlertCircle className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Days Since Last Miss</p>
                        <p className="font-semibold">
                          {snapshot.daysSinceLastMiss != null ? snapshot.daysSinceLastMiss : <span className="text-muted-foreground font-normal text-xs">First miss</span>}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Miss history */}
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Miss History</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold">{snapshot.missesInLast30d ?? 0}</p>
                        <p className="text-xs text-muted-foreground">Last 30d</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">{snapshot.missesInLast60d ?? 0}</p>
                        <p className="text-xs text-muted-foreground">Last 60d</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">{snapshot.missesInLast90d ?? 0}</p>
                        <p className="text-xs text-muted-foreground">Last 90d</p>
                      </div>
                    </div>
                  </div>

                  {/* Completion rate */}
                  <div className="flex items-start gap-2">
                    <div className="p-1.5 rounded-md bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                      <Target className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Baseline Completion Rate</p>
                      <p className="font-semibold">
                        {snapshot.baselineCompletionRate != null ? `${snapshot.baselineCompletionRate.toFixed(1)}%` : <span className="text-muted-foreground font-normal text-xs">Insufficient data</span>}
                      </p>
                    </div>
                  </div>

                  {/* Pattern indicators */}
                  <div className="flex flex-wrap gap-2">
                    {snapshot.isFirstMissIn30d && (
                      <Badge variant="outline" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        First miss in 30 days
                      </Badge>
                    )}
                    {snapshot.isIncreasingFrequency && (
                      <Badge variant="destructive" className="gap-1">
                        <TrendingDown className="h-3 w-3" />
                        Increasing frequency
                      </Badge>
                    )}
                    {!snapshot.isFirstMissIn30d && !snapshot.isIncreasingFrequency && (
                      <Badge variant="secondary" className="gap-1">
                        No pattern detected
                      </Badge>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  State snapshot not available for this record.
                </p>
              )}
            </div>

            {/* Notes */}
            {selectedRecord?.notes && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Notes</h4>
                  <p className="text-sm">{selectedRecord.notes}</p>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </PageLoader>
  );
}
