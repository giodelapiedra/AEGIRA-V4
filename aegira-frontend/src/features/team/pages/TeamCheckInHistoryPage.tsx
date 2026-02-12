import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { History, Search } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageLoader } from '@/components/common/PageLoader';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import { formatDate } from '@/lib/utils/date.utils';
import { ReadinessBadge } from '@/components/common/badge-utils';

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
    cell: ({ row }) => formatDate(row.original.checkInDate, 'MMM d, yyyy'),
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
    cell: ({ row }) => <ReadinessBadge level={row.original.readinessLevel} />,
  },
];

export function TeamCheckInHistoryPage() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['team', 'check-in-history', pagination.pageIndex, pagination.pageSize, search],
    staleTime: STALE_TIMES.IMMUTABLE, // Historical data rarely changes
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(pagination.pageIndex + 1),
        limit: String(pagination.pageSize),
      });
      if (search) params.set('search', search);
      return apiClient.get<CheckInHistoryResponse>(
        `${ENDPOINTS.TEAM_MANAGEMENT.CHECK_IN_HISTORY}?${params.toString()}`
      );
    },
  });

  const items = data?.items || [];
  const totalPages = data?.pagination?.totalPages || 0;
  const total = data?.pagination?.total || 0;

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
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
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search by worker name or email..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="max-w-sm"
                />
                <Button onClick={handleSearch} variant="secondary" size="sm">
                  <Search className="h-4 w-4 mr-1" />
                  Search
                </Button>
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
