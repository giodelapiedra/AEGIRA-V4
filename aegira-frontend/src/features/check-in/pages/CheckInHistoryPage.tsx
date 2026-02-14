import { useState } from 'react';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { ClipboardList } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageLoader } from '@/components/common/PageLoader';
import { ReadinessCategoryBadge, SubmissionStatusBadge } from '@/components/common/badge-utils';
import { useCheckInHistory } from '../hooks/useCheckInHistory';
import { formatDate, formatTime } from '@/lib/utils/date.utils';
import type { CheckIn } from '@/types/check-in.types';

const columns: ColumnDef<CheckIn>[] = [
  {
    accessorKey: 'checkInDate',
    header: ({ column }) => <SortableHeader column={column}>Date</SortableHeader>,
    cell: ({ row }) => (
      <span className="font-medium">{formatDate(row.original.checkInDate)}</span>
    ),
  },
  {
    accessorKey: 'submittedAt',
    header: 'Time',
    cell: ({ row }) => (
      <span className="text-muted-foreground">{formatTime(row.original.submittedAt)}</span>
    ),
  },
  {
    id: 'submissionStatus',
    header: 'Status',
    cell: ({ row }) => (
      <SubmissionStatusBadge
        isLate={row.original.isLate}
      />
    ),
  },
  {
    accessorKey: 'readiness',
    header: 'Readiness',
    cell: ({ row }) => <ReadinessCategoryBadge category={row.original.readinessResult?.category} />,
  },
  {
    accessorKey: 'sleepHours',
    header: 'Sleep',
    cell: ({ row }) => `${row.original.sleepHours}h`,
  },
  {
    accessorKey: 'sleepQuality',
    header: 'Quality',
    cell: ({ row }) => `${row.original.sleepQuality}/10`,
  },
  {
    accessorKey: 'energyLevel',
    header: 'Energy',
    cell: ({ row }) => `${row.original.energyLevel}/10`,
  },
  {
    accessorKey: 'stressLevel',
    header: 'Stress',
    cell: ({ row }) => `${row.original.stressLevel}/10`,
  },
  {
    accessorKey: 'painLevel',
    header: 'Pain',
    cell: ({ row }) => `${row.original.painLevel}/10`,
  },
];

export function CheckInHistoryPage() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const { data, isLoading, error } = useCheckInHistory({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  });

  const checkIns = data?.items || [];
  const pageCount = data?.totalPages || 0;

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
    <div className="space-y-6">
      <PageHeader
        title="Check-In History"
        description="View your past check-in records"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Your Check-Ins ({data?.total || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={checkIns}
            pageCount={pageCount}
            pagination={pagination}
            onPaginationChange={setPagination}
            isLoading={isLoading}
            emptyMessage="No check-ins yet. Your check-in history will appear here."
          />
        </CardContent>
      </Card>
    </div>
    </PageLoader>
  );
}
