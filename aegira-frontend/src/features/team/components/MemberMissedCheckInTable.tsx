import { useState, useMemo } from 'react';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { AlertTriangle, Eye, Flame, TrendingUp, TrendingDown, Calendar, AlertCircle, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

  const columns = useMemo(() => getColumns(setSelectedRecord), [setSelectedRecord]);
  const snapshot = selectedRecord?.stateSnapshot;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Missed Check-Ins
          </CardTitle>
          <CardDescription>
            {total > 0
              ? `${total} total records`
              : 'View this member\'s missed check-in history'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={items}
            pageCount={pageCount}
            pagination={pagination}
            onPaginationChange={setPagination}
            isLoading={isLoading}
            totalCount={total}
            emptyMessage="This member has no missed check-in records."
          />
        </CardContent>
      </Card>

      {/* State Snapshot Detail Sheet */}
      <Sheet open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Missed Check-in Details</SheetTitle>
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

          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
