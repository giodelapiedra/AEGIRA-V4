import { useState } from 'react';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { ClipboardList } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageLoader } from '@/components/common/PageLoader';
import { useCheckInHistory } from '../hooks/useCheckInHistory';
import { formatDate } from '@/lib/utils/date.utils';
import { getReadinessLabel } from '@/lib/utils/format.utils';
import type { CheckIn } from '@/types/check-in.types';

const getReadinessBadge = (checkIn: CheckIn) => {
  const category = checkIn.readinessResult?.category;
  const label = category ? getReadinessLabel(category) : 'Unknown';

  switch (category) {
    case 'ready':
      return <Badge variant="success">{label}</Badge>;
    case 'modified_duty':
      return <Badge variant="warning">{label}</Badge>;
    case 'needs_attention':
      return <Badge className="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400">{label}</Badge>;
    case 'not_ready':
      return <Badge variant="destructive">{label}</Badge>;
    default:
      return <Badge variant="outline">N/A</Badge>;
  }
};

const columns: ColumnDef<CheckIn>[] = [
  {
    accessorKey: 'checkInDate',
    header: ({ column }) => <SortableHeader column={column}>Date</SortableHeader>,
    cell: ({ row }) => (
      <span className="font-medium">{formatDate(row.original.checkInDate)}</span>
    ),
  },
  {
    accessorKey: 'readiness',
    header: 'Readiness',
    cell: ({ row }) => getReadinessBadge(row.original),
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
    accessorKey: 'fatigueLevel',
    header: 'Fatigue',
    cell: ({ row }) => `${row.original.fatigueLevel}/10`,
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
    pageSize: pagination.pageSize,
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
