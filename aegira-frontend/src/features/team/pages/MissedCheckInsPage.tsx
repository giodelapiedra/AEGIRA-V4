import { useState, useMemo } from 'react';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
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

interface DetailRowProps {
  label: string;
  value: string | number | null | undefined;
  fallback?: string;
}

function DetailRow({ label, value, fallback = '-' }: DetailRowProps) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? fallback}</span>
    </div>
  );
}

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
              {selectedRecord && formatDate(selectedRecord.date, 'EEEE, MMMM d, yyyy')}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <DetailRow label="Team" value={selectedRecord?.teamName} />
            <DetailRow label="Team Leader" value={selectedRecord?.teamLeaderName} fallback="Not assigned" />
            <DetailRow label="Schedule" value={selectedRecord?.scheduleWindow} />

            {snapshot && (
              <>
                <Separator />

                <DetailRow label="Streak Before Miss" value={snapshot.checkInStreakBefore != null ? `${snapshot.checkInStreakBefore} days` : null} fallback="No data" />
                <DetailRow label="Avg Readiness" value={snapshot.recentReadinessAvg != null ? `${snapshot.recentReadinessAvg.toFixed(1)}%` : null} fallback="No data" />
                <DetailRow label="Completion Rate" value={snapshot.baselineCompletionRate != null ? `${snapshot.baselineCompletionRate.toFixed(1)}%` : null} fallback="No data" />
                <DetailRow label="Days Since Last Check-in" value={snapshot.daysSinceLastCheckIn} fallback="No prior" />
                <DetailRow label="Days Since Last Miss" value={snapshot.daysSinceLastMiss} fallback="First miss" />

                <Separator />

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Misses</span>
                  <div className="flex gap-3 text-xs">
                    <span><span className="font-medium">{snapshot.missesInLast30d ?? 0}</span> / 30d</span>
                    <span><span className="font-medium">{snapshot.missesInLast60d ?? 0}</span> / 60d</span>
                    <span><span className="font-medium">{snapshot.missesInLast90d ?? 0}</span> / 90d</span>
                  </div>
                </div>

                {(snapshot.isFirstMissIn30d || snapshot.isIncreasingFrequency) && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {snapshot.isFirstMissIn30d && (
                      <Badge variant="outline">First miss in 30 days</Badge>
                    )}
                    {snapshot.isIncreasingFrequency && (
                      <Badge variant="destructive">Increasing frequency</Badge>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </PageLoader>
  );
}
