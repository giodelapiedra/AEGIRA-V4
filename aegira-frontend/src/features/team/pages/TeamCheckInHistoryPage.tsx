import { useState, useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { History, Search } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageLoader } from '@/components/common/PageLoader';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';

interface CheckInHistoryItem {
  id: string;
  personId: string;
  workerName: string;
  workerEmail: string;
  eventId: string;
  checkInDate: string;
  hoursSlept: number;
  sleepQuality: number;
  stressLevel: number;
  physicalCondition: number;
  notes: string | null;
  readinessScore: number;
  readinessLevel: 'GREEN' | 'YELLOW' | 'RED';
  sleepScore: number;
  stressScore: number;
  physicalScore: number;
  painScore: number | null;
  createdAt: string;
}

interface CheckInHistoryResponse {
  items: CheckInHistoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const getReadinessBadge = (level: string) => {
  switch (level) {
    case 'GREEN':
      return <Badge variant="success">Green</Badge>;
    case 'YELLOW':
      return <Badge variant="warning">Yellow</Badge>;
    case 'RED':
      return <Badge variant="destructive">Red</Badge>;
    default:
      return <Badge>{level}</Badge>;
  }
};

const columns: ColumnDef<CheckInHistoryItem>[] = [
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
    accessorKey: 'checkInDate',
    header: ({ column }) => <SortableHeader column={column}>Date</SortableHeader>,
    cell: ({ row }) =>
      new Date(row.original.checkInDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
  },
  {
    accessorKey: 'hoursSlept',
    header: 'Hours Slept',
    cell: ({ row }) => `${row.original.hoursSlept}h`,
  },
  {
    accessorKey: 'sleepQuality',
    header: 'Sleep Quality',
    cell: ({ row }) => (
      <span className="font-medium">{row.original.sleepQuality}/10</span>
    ),
  },
  {
    accessorKey: 'stressLevel',
    header: 'Stress Level',
    cell: ({ row }) => (
      <span className="font-medium">{row.original.stressLevel}/10</span>
    ),
  },
  {
    accessorKey: 'physicalCondition',
    header: 'Physical',
    cell: ({ row }) => (
      <span className="font-medium">{row.original.physicalCondition}/10</span>
    ),
  },
  {
    accessorKey: 'readinessScore',
    header: ({ column }) => <SortableHeader column={column}>Score</SortableHeader>,
    cell: ({ row }) => (
      <span className="font-bold">{row.original.readinessScore}</span>
    ),
  },
  {
    accessorKey: 'readinessLevel',
    header: 'Readiness',
    cell: ({ row }) => getReadinessBadge(row.original.readinessLevel),
  },
];

export function TeamCheckInHistoryPage() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const { data, isLoading, error } = useQuery({
    queryKey: ['team', 'check-in-history', pagination.pageIndex, pagination.pageSize, deferredSearch],
    staleTime: STALE_TIMES.IMMUTABLE, // Historical data rarely changes
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(pagination.pageIndex + 1),
        limit: String(pagination.pageSize),
      });
      if (deferredSearch) params.set('search', deferredSearch);
      return apiClient.get<CheckInHistoryResponse>(
        `${ENDPOINTS.TEAM_MANAGEMENT.CHECK_IN_HISTORY}?${params.toString()}`
      );
    },
  });

  const items = data?.items || [];
  const totalPages = data?.pagination?.totalPages || 0;
  const total = data?.pagination?.total || 0;

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <div className="space-y-6">
        <PageHeader
          title="Check-In History"
          description="View the check-in history of your team workers"
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Worker Check-Ins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Server-side search */}
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by worker name or email..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>

              <DataTable
                columns={columns}
                data={items}
                isLoading={isLoading}
                pageCount={totalPages}
                pagination={pagination}
                onPaginationChange={setPagination}
                totalCount={total}
                emptyMessage="No check-in records found."
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLoader>
  );
}
