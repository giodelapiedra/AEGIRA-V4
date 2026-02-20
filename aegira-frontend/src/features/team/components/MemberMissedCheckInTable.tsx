import { useState, useMemo } from 'react';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Eye, Flame, TrendingUp, Calendar, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MissedCheckInStatusBadge } from '@/components/common/badge-utils';
import { Button } from '@/components/ui/button';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { formatDate } from '@/lib/utils/date.utils';
import { DAY_NAMES } from '@/lib/constants';
import { useWorkerMissedCheckIns, type MissedCheckInRecord } from '../hooks/useWorkerMissedCheckIns';

interface MemberMissedCheckInTableProps {
  personId: string;
}

const getColumns = (onView: (record: MissedCheckInRecord) => void): ColumnDef<MissedCheckInRecord>[] => [
  {
    accessorKey: 'date',
    header: ({ column }) => <SortableHeader column={column}>Date</SortableHeader>,
    cell: ({ row }) => (
      <span className="font-medium">
        {formatDate(row.original.date, 'MMM d, yyyy')}
      </span>
    ),
  },
  {
    accessorKey: 'scheduleWindow',
    header: 'Schedule',
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.scheduleWindow}</span>
    ),
  },
  {
    id: 'resolutionStatus',
    header: 'Status',
    cell: ({ row }) => (
      <MissedCheckInStatusBadge resolvedAt={row.original.resolvedAt} />
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

export function MemberMissedCheckInTable({ personId }: MemberMissedCheckInTableProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [selectedRecord, setSelectedRecord] = useState<MissedCheckInRecord | null>(null);

  const { data, isLoading } = useWorkerMissedCheckIns({
    personId,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  });

  const items = data?.items ?? [];
  const total = data?.pagination?.total ?? 0;
  const pageCount = data?.pagination?.totalPages ?? 0;

  const columns = useMemo(() => getColumns(setSelectedRecord), []);
  const snapshot = selectedRecord?.stateSnapshot;

  return (
    <>
      <DataTable
        columns={columns}
        data={items}
        pageCount={pageCount}
        pagination={pagination}
        onPaginationChange={setPagination}
        isLoading={isLoading}
        totalCount={total}
        emptyMessage="No missed check-in records."
      />

      {/* Detail Sheet */}
      <Sheet open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Missed Check-in Details</SheetTitle>
            <SheetDescription>
              {selectedRecord && formatDate(selectedRecord.date, 'MMMM d, yyyy')}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Basic info grid */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <div className="mt-1">
                  <MissedCheckInStatusBadge resolvedAt={selectedRecord?.resolvedAt} />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Team Leader</p>
                <p className="font-medium mt-1">{selectedRecord?.teamLeaderName || 'Not assigned'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Schedule</p>
                <p className="font-medium mt-1">{selectedRecord?.scheduleWindow}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Day</p>
                <p className="font-medium mt-1">{snapshot?.dayOfWeek != null ? DAY_NAMES[snapshot.dayOfWeek] : '—'}</p>
              </div>
            </div>

            <Separator />

            {/* Snapshot */}
            <div className="space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Context at time of miss</p>

              {snapshot ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 rounded-md bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                        <Flame className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Streak</p>
                        <p className="text-sm font-semibold">
                          {snapshot.checkInStreakBefore != null
                            ? `${snapshot.checkInStreakBefore}d`
                            : <span className="text-muted-foreground font-normal">—</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Avg Readiness</p>
                        <p className="text-sm font-semibold">
                          {snapshot.recentReadinessAvg != null
                            ? `${snapshot.recentReadinessAvg.toFixed(1)}%`
                            : <span className="text-muted-foreground font-normal">—</span>}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 rounded-md bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Since Last Check-in</p>
                        <p className="text-sm font-semibold">
                          {snapshot.daysSinceLastCheckIn != null
                            ? `${snapshot.daysSinceLastCheckIn}d`
                            : <span className="text-muted-foreground font-normal">—</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 rounded-md bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                        <AlertCircle className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Since Last Miss</p>
                        <p className="text-sm font-semibold">
                          {snapshot.daysSinceLastMiss != null
                            ? `${snapshot.daysSinceLastMiss}d`
                            : <span className="text-muted-foreground font-normal">First</span>}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Miss frequency */}
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-2">Miss Frequency</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold">{snapshot.missesInLast30d ?? 0}</p>
                        <p className="text-xs text-muted-foreground">30d</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">{snapshot.missesInLast60d ?? 0}</p>
                        <p className="text-xs text-muted-foreground">60d</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">{snapshot.missesInLast90d ?? 0}</p>
                        <p className="text-xs text-muted-foreground">90d</p>
                      </div>
                    </div>
                  </div>

                  {snapshot.isFirstMissIn30d && (
                    <Badge variant="outline" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      First miss in 30 days
                    </Badge>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Snapshot not available for this record.
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
