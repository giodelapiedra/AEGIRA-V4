import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { Calendar, Plus, Trash2, Edit2 } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageLoader } from '@/components/common/PageLoader';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import { useToast } from '@/lib/hooks/use-toast';
import type { PaginatedResponse } from '@/types/common.types';

interface Holiday {
  id: string;
  name: string;
  date: string;
  recurring: boolean;
  createdAt: string;
}

interface HolidayFormData {
  name: string;
  date: string;
  recurring: boolean;
}

const getHolidayColumns = (
  onEdit: (holiday: Holiday) => void,
  onDelete: (id: string) => void,
  isDeleting: boolean
): ColumnDef<Holiday>[] => [
  {
    accessorKey: 'name',
    header: ({ column }) => <SortableHeader column={column}>Holiday Name</SortableHeader>,
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: 'date',
    header: ({ column }) => <SortableHeader column={column}>Date</SortableHeader>,
  },
  {
    accessorKey: 'recurring',
    header: 'Recurring',
    cell: ({ row }) =>
      row.original.recurring ? (
        <Badge variant="success">Yearly</Badge>
      ) : (
        <Badge variant="outline">One-time</Badge>
      ),
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onEdit(row.original)}>
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDelete(row.original.id)}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    ),
  },
];

export function AdminHolidaysPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [formData, setFormData] = useState<HolidayFormData>({
    name: '',
    date: '',
    recurring: true,
  });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'holidays'],
    staleTime: STALE_TIMES.STATIC,
    queryFn: () => apiClient.get<PaginatedResponse<Holiday>>(ENDPOINTS.ADMIN.HOLIDAYS),
  });

  const createMutation = useMutation({
    mutationFn: (data: HolidayFormData) => apiClient.post(ENDPOINTS.ADMIN.HOLIDAYS, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'holidays'] });
      queryClient.invalidateQueries({ queryKey: ['check-ins', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ variant: 'success', title: 'Holiday created', description: `${variables.name} has been added.` });
      setShowForm(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to create holiday', description: error.message || 'Something went wrong.' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<HolidayFormData> }) =>
      apiClient.patch(ENDPOINTS.ADMIN.HOLIDAY_BY_ID(id), data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'holidays'] });
      queryClient.invalidateQueries({ queryKey: ['check-ins', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ variant: 'success', title: 'Holiday updated', description: `${variables.data.name} has been updated.` });
      setEditingHoliday(null);
      setShowForm(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to update holiday', description: error.message || 'Something went wrong.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(ENDPOINTS.ADMIN.HOLIDAY_BY_ID(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'holidays'] });
      queryClient.invalidateQueries({ queryKey: ['check-ins', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ variant: 'success', title: 'Holiday deleted', description: 'The holiday has been removed.' });
      setDeleteTarget(null);
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to delete holiday', description: error.message || 'Something went wrong.' });
      setDeleteTarget(null);
    },
  });

  const resetForm = () => {
    setFormData({ name: '', date: '', recurring: true });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingHoliday) {
      const updates: Partial<HolidayFormData> = {};
      if (formData.name !== editingHoliday.name) updates.name = formData.name;
      if (formData.date !== editingHoliday.date) updates.date = formData.date;
      if (formData.recurring !== editingHoliday.recurring) updates.recurring = formData.recurring;

      if (Object.keys(updates).length === 0) {
        toast({ title: 'No changes', description: 'No modifications were detected.' });
        setShowForm(false);
        setEditingHoliday(null);
        resetForm();
        return;
      }

      updateMutation.mutate({ id: editingHoliday.id, data: updates });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setFormData({
      name: holiday.name,
      date: holiday.date,
      recurring: holiday.recurring,
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
  };

  const columns = getHolidayColumns(handleEdit, handleDelete, deleteMutation.isPending);

  const holidays = data?.items || [];

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
    <div className="space-y-6">
      <PageHeader
        title="Holiday Management"
        description="Manage company holidays"
        action={
          <Button onClick={() => { setShowForm(true); setEditingHoliday(null); resetForm(); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Holiday
          </Button>
        }
      />

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Holiday Name</Label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="flex items-center space-x-4 rounded-lg border p-4">
                <Switch
                  id="recurring"
                  checked={formData.recurring}
                  onCheckedChange={(checked) => setFormData({ ...formData, recurring: checked })}
                />
                <div className="space-y-0.5">
                  <Label htmlFor="recurring" className="text-base">
                    Recurring Yearly
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {formData.recurring
                      ? 'This holiday repeats every year on the same date'
                      : 'This is a one-time holiday'}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowForm(false); setEditingHoliday(null); resetForm(); }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingHoliday
                    ? (updateMutation.isPending ? 'Updating...' : 'Update Holiday')
                    : (createMutation.isPending ? 'Creating...' : 'Create Holiday')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Company Holidays ({holidays.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={holidays}
            isLoading={isLoading}
            searchable
            searchPlaceholder="Search holidays..."
            searchColumn="name"
            emptyMessage="No holidays configured. Add your first holiday above."
          />
        </CardContent>
      </Card>
    </div>

    <ConfirmDialog
      open={!!deleteTarget}
      onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      title="Delete Holiday"
      description="Are you sure you want to delete this holiday? This action cannot be undone."
      confirmLabel="Delete"
      variant="destructive"
      isLoading={deleteMutation.isPending}
      onConfirm={() => {
        if (deleteTarget) {
          deleteMutation.mutate(deleteTarget);
        }
      }}
    />
    </PageLoader>
  );
}
