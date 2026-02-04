import { useState } from 'react';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { useWorkerMissedCheckIns, type MissedCheckInRecord } from '../hooks/useWorkerMissedCheckIns';

interface MemberMissedCheckInTableProps {
  personId: string;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'OPEN':
      return <Badge variant="destructive">Open</Badge>;
    case 'INVESTIGATING':
      return <Badge variant="warning">Investigating</Badge>;
    case 'EXCUSED':
      return <Badge variant="outline">Excused</Badge>;
    case 'RESOLVED':
      return <Badge variant="success">Resolved</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};

const columns: ColumnDef<MissedCheckInRecord>[] = [
  {
    accessorKey: 'date',
    header: ({ column }) => <SortableHeader column={column}>Date</SortableHeader>,
    cell: ({ row }) => (
      <span className="font-medium">
        {new Date(row.original.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
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
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => getStatusBadge(row.original.status),
  },
  {
    accessorKey: 'notes',
    header: 'Notes',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.notes || '-'}</span>
    ),
  },
];

export function MemberMissedCheckInTable({ personId }: MemberMissedCheckInTableProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const { data, isLoading } = useWorkerMissedCheckIns({
    personId,
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
  });

  const items = data?.items ?? [];
  const total = data?.pagination?.total ?? 0;
  const pageCount = data?.pagination?.totalPages ?? 0;

  return (
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
  );
}
