import { useState, useMemo } from 'react';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Eye, Flame, TrendingUp, Calendar, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { MissedCheckInStatusBadge } from '@/components/common/badge-utils';
import { Button } from '@/components/ui/button';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageLoader } from '@/components/common/PageLoader';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { formatDate } from '@/lib/utils/date.utils';
import { DAY_NAMES } from '@/lib/constants';
import {
  useMissedCheckIns,
  type MissedCheckIn,
} from '../hooks/useMissedCheckIns';

const getColumns = (
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
    cell: ({ row }) => formatDate(row.original.date, 'MMM d, yyyy'),
  },
  {
    accessorKey: 'scheduleWindow',
    header: 'Schedule',
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
        aria-label="View missed check-in details"
      >
        <Eye className="h-4 w-4" />
      </Button>
    ),
  },
];

export function MissedCheckInsPage() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [selectedRecord, setSelectedRecord] = useState<MissedCheckIn | null>(null);

  const { data, isLoading, error } = useMissedCheckIns(
    pagination.pageIndex + 1,
    pagination.pageSize
  );

  const items = data?.items || [];
  const totalPages = data?.pagination?.totalPages || 0;
  const totalCount = data?.pagination?.total || 0;

  const columns = useMemo(
    () => getColumns(setSelectedRecord),
    []
  );

  const snapshot = selectedRecord?.stateSnapshot;

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <div className="space-y-4">
        <PageHeader
          title="Missed Check-ins"
          description="Review workers who missed their daily check-ins"
        />

        <DataTable
          columns={columns}
          data={items}
          isLoading={isLoading}
          pageCount={totalPages}
          pagination={pagination}
          onPaginationChange={setPagination}
          totalCount={totalCount}
          emptyMessage="No missed check-ins found."
        />
      </div>

      <Sheet open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{selectedRecord?.workerName}</SheetTitle>
            <SheetDescription>
              {selectedRecord && formatDate(selectedRecord.date, 'MMMM d, yyyy')}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Basic Info */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Basic Info</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <MissedCheckInStatusBadge resolvedAt={selectedRecord?.resolvedAt} />
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">Team</p>
                  <p className="font-medium">{selectedRecord?.teamName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Team Leader</p>
                  <p className="font-medium">{selectedRecord?.teamLeaderName || 'Not assigned'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Schedule</p>
                  <p className="font-medium">{selectedRecord?.scheduleWindow}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Day</p>
                  <p className="font-medium">{snapshot?.dayOfWeek != null ? DAY_NAMES[snapshot.dayOfWeek] : '-'}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* State When Missed */}
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

                  {snapshot.isFirstMissIn30d && (
                    <Badge variant="outline" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      First miss in 30 days
                    </Badge>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  State snapshot not available for this record.
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </PageLoader>
  );
}
