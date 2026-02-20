import { useState } from 'react';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { ReadinessCategoryBadge, SubmissionStatusBadge } from '@/components/common/badge-utils';
import { useWorkerCheckIns } from '../hooks/useWorkerCheckIns';
import { formatDate, formatTime } from '@/lib/utils/date.utils';
import type { CheckIn } from '@/types/check-in.types';

interface MemberCheckInTableProps {
  personId: string;
}

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
    header: 'Submission',
    cell: ({ row }) => (
      <SubmissionStatusBadge isLate={row.original.isLate} />
    ),
  },
  {
    accessorKey: 'sleepHours',
    header: ({ column }) => <SortableHeader column={column}>Sleep (hrs)</SortableHeader>,
    cell: ({ row }) => <span className="text-center block">{row.original.sleepHours}</span>,
  },
  {
    accessorKey: 'sleepQuality',
    header: 'Sleep Quality',
    cell: ({ row }) => <span className="text-center block">{row.original.sleepQuality}/10</span>,
  },
  {
    accessorKey: 'stressLevel',
    header: 'Stress',
    cell: ({ row }) => <span className="text-center block">{row.original.stressLevel}/10</span>,
  },
  {
    accessorKey: 'energyLevel',
    header: 'Energy',
    cell: ({ row }) => <span className="text-center block">{row.original.energyLevel}/10</span>,
  },
  {
    accessorKey: 'readinessResult.score',
    header: ({ column }) => <SortableHeader column={column}>Score</SortableHeader>,
    cell: ({ row }) => (
      <span className="text-center block font-semibold">{row.original.readinessResult.score}%</span>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <ReadinessCategoryBadge category={row.original.readinessResult.category} />
    ),
  },
];

export function MemberCheckInTable({ personId }: MemberCheckInTableProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const { data, isLoading } = useWorkerCheckIns({
    personId,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  });

  const checkIns = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = data?.totalPages ?? 0;

  return (
    <DataTable
      columns={columns}
      data={checkIns}
      pageCount={pageCount}
      pagination={pagination}
      onPaginationChange={setPagination}
      isLoading={isLoading}
      totalCount={total}
      emptyMessage="No check-ins submitted yet."
    />
  );
}
