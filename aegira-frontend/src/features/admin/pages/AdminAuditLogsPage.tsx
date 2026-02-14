import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { FileText, Download, Lock, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { RoleBadge } from '@/components/common/RoleBadge';
import { TableSearch } from '@/components/common/TableSearch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageLoader } from '@/components/common/PageLoader';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import { useToast } from '@/lib/hooks/use-toast';
import { useVerifyPassword } from '@/features/auth/hooks/useVerifyPassword';
import type { PaginatedResponse } from '@/types/common.types';
import type { UserRole } from '@/types/auth.types';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  userEmail: string;
  userRole: UserRole | null;
  details: string;
  createdAt: string;
}

const verifySchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

type VerifyFormData = z.infer<typeof verifySchema>;

const getActionBadge = (action: string) => {
  if (action.includes('LOGIN') || action.includes('LOGOUT')) {
    return <Badge variant="outline">{action}</Badge>;
  }
  if (action.includes('CREATE')) {
    return <Badge variant="success">{action}</Badge>;
  }
  if (action.includes('UPDATE')) {
    return <Badge variant="warning">{action}</Badge>;
  }
  if (action.includes('DELETE')) {
    return <Badge variant="destructive">{action}</Badge>;
  }
  return <Badge>{action}</Badge>;
};

const columns: ColumnDef<AuditLog>[] = [
  {
    accessorKey: 'createdAt',
    header: ({ column }) => <SortableHeader column={column}>Timestamp</SortableHeader>,
    cell: ({ row }) => (
      <span className="text-sm">{new Date(row.original.createdAt).toLocaleString()}</span>
    ),
  },
  {
    accessorKey: 'userEmail',
    header: ({ column }) => <SortableHeader column={column}>User</SortableHeader>,
  },
  {
    accessorKey: 'userRole',
    header: 'Role',
    cell: ({ row }) => row.original.userRole ? <RoleBadge role={row.original.userRole} /> : <span className="text-sm text-muted-foreground">-</span>,
  },
  {
    accessorKey: 'action',
    header: 'Action',
    cell: ({ row }) => getActionBadge(row.original.action),
  },
];

export function AdminAuditLogsPage() {
  const [verified, setVerified] = useState(false);
  const { toast } = useToast();
  const verifyMutation = useVerifyPassword();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<VerifyFormData>({
    resolver: zodResolver(verifySchema),
    defaultValues: {
      password: '',
    },
  });

  const onVerify = async (data: VerifyFormData) => {
    try {
      await verifyMutation.mutateAsync(data);
      setVerified(true);
      reset();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Verification failed',
        description: error instanceof Error ? error.message : 'Incorrect password. Please try again.',
      });
    }
  };

  if (!verified) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>Verify Your Identity</CardTitle>
            <CardDescription>Enter your password to access audit logs</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onVerify)} className="space-y-4">
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  {...register('password')}
                  className="h-11"
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full h-11"
                disabled={isSubmitting || verifyMutation.isPending}
              >
                {verifyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <AuditLogsContent />;
}

function AuditLogsContent() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const { toast } = useToast();
  const [dateFilter, setDateFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'audit-logs', pagination.pageIndex, pagination.pageSize, dateFilter, search],
    staleTime: STALE_TIMES.IMMUTABLE,
    placeholderData: keepPreviousData, // Smooth pagination transitions
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(pagination.pageIndex + 1),
        limit: String(pagination.pageSize),
      });
      if (dateFilter) params.set('date', dateFilter);
      if (search) params.set('search', search);
      return apiClient.get<PaginatedResponse<AuditLog>>(
        `${ENDPOINTS.ADMIN.AUDIT_LOGS}?${params.toString()}`
      );
    },
  });

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleExport = async () => {
    try {
      const allItems: AuditLog[] = [];
      const maxPages = 10;
      for (let page = 1; page <= maxPages; page++) {
        const response = await apiClient.get<PaginatedResponse<AuditLog>>(
          `${ENDPOINTS.ADMIN.AUDIT_LOGS}?page=${page}&limit=100`
        );
        allItems.push(...response.items);
        if (!response.items.length || page >= (response.pagination?.totalPages ?? 1)) break;
      }
      const blob = new Blob([JSON.stringify(allItems, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast({ variant: 'destructive', title: 'Export failed', description: 'Could not export audit logs. Please try again.' });
    }
  };

  const logs = data?.items || [];
  const pageCount = data?.pagination?.totalPages || 0;

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="View system activity and audit trail"
        action={
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export Logs
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <TableSearch
                placeholder="Search by user name or email..."
                value={searchInput}
                onChange={setSearchInput}
                onSearch={handleSearch}
              />
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value);
                    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                  }}
                  className="w-auto h-9"
                />
                {dateFilter && (
                  <Button variant="outline" size="sm" onClick={() => {
                    setDateFilter('');
                    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                  }}>
                    Clear Date
                  </Button>
                )}
              </div>
            </div>

            <DataTable
            columns={columns}
            data={logs}
            pageCount={pageCount}
            pagination={pagination}
            onPaginationChange={setPagination}
            isLoading={isLoading}
            totalCount={data?.pagination?.total || 0}
            emptyMessage="No audit logs found."
          />
          </div>
        </CardContent>
      </Card>
    </div>
    </PageLoader>
  );
}
