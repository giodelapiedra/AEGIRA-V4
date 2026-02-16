import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, UserCog, Calendar, Clock } from 'lucide-react';
import { formatDate } from '@/lib/utils/date.utils';
import { formatWorkDays } from '@/lib/utils/string.utils';
import { isEndTimeAfterStart, TIME_REGEX, WORK_DAYS_REGEX } from '@/lib/utils/format.utils';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageLoader } from '@/components/common/PageLoader';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { usePerson, useUpdatePerson, useCancelTransfer } from '@/features/person/hooks/usePersons';
import { useTeams } from '@/features/team/hooks/useTeams';
import { useToast } from '@/lib/hooks/use-toast';
import { ROUTES } from '@/config/routes.config';
import type { Person } from '@/types/person.types';
import type { Team } from '@/types/team.types';
import { WORK_DAYS_OPTIONS } from '@/types/team.types';

const updateWorkerSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required').max(100),
    lastName: z.string().min(1, 'Last name is required').max(100),
    role: z.enum(['WORKER', 'TEAM_LEAD', 'SUPERVISOR', 'WHS', 'ADMIN']),
    teamId: z.string().nullable().optional(),
    isActive: z.boolean(),
    // Worker schedule override (optional, empty string clears override)
    workDays: z.string().regex(WORK_DAYS_REGEX, 'Invalid work days format').optional().or(z.literal('')),
    checkInStart: z.string().regex(TIME_REGEX, 'Invalid time format (HH:MM)').optional().or(z.literal('')),
    checkInEnd: z.string().regex(TIME_REGEX, 'Invalid time format (HH:MM)').optional().or(z.literal('')),
  })
  .refine(
    (data) => {
      if (data.role === 'WORKER' && !data.teamId) return false;
      return true;
    },
    { message: 'Team is required for workers', path: ['teamId'] }
  )
  .refine(
    (data) => {
      // Both checkInStart and checkInEnd must be set together or both empty
      const hasStart = !!data.checkInStart;
      const hasEnd = !!data.checkInEnd;
      return hasStart === hasEnd;
    },
    {
      message: 'Both check-in start and end times must be set together',
      path: ['checkInStart'],
    }
  )
  .refine(
    (data) => {
      if (data.checkInStart && data.checkInEnd) {
        return isEndTimeAfterStart(data.checkInStart, data.checkInEnd);
      }
      return true;
    },
    {
      message: 'Check-in end time must be after start time',
      path: ['checkInEnd'],
    }
  );

type UpdateWorkerFormData = z.infer<typeof updateWorkerSchema>;

export function AdminWorkerEditPage() {
  const { workerId } = useParams<{ workerId: string }>();
  const { data: person, isLoading: isLoadingPerson, error } = usePerson(workerId || '');
  const { data: teamsData, isLoading: isLoadingTeams } = useTeams(1, 100);

  const isLoading = isLoadingPerson || isLoadingTeams;

  if (!person && !isLoading) {
    return <ErrorMessage message="Worker not found" />;
  }

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="form">
      {person && <WorkerEditForm key={person.updated_at} person={person} teams={(teamsData?.items || []).filter((t) => t.is_active)} />}
    </PageLoader>
  );
}

interface WorkerEditFormProps {
  person: Person;
  teams: Team[];
}

function WorkerEditForm({ person, teams }: WorkerEditFormProps) {
  const navigate = useNavigate();
  const updatePerson = useUpdatePerson();
  const cancelTransfer = useCancelTransfer();
  const { toast } = useToast();
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<UpdateWorkerFormData | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UpdateWorkerFormData>({
    resolver: zodResolver(updateWorkerSchema),
    defaultValues: {
      firstName: person.first_name,
      lastName: person.last_name,
      role: person.role,
      teamId: person.team_id || null,
      isActive: person.is_active,
      workDays: person.work_days || '',
      checkInStart: person.check_in_start || '',
      checkInEnd: person.check_in_end || '',
    },
  });

  const selectedRole = watch('role');
  const selectedTeamId = watch('teamId');
  const isActive = watch('isActive');
  const workDaysValue = watch('workDays') || '';
  const selectedWorkDays = workDaysValue ? workDaysValue.split(',').filter(Boolean) : [];

  const toggleWorkDay = (dayValue: string) => {
    const newSelection = selectedWorkDays.includes(dayValue)
      ? selectedWorkDays.filter((d) => d !== dayValue)
      : [...selectedWorkDays, dayValue].sort();

    setValue('workDays', newSelection.length > 0 ? newSelection.join(',') : '', { shouldValidate: true });
  };

  const handleCancelTransfer = async () => {
    try {
      await cancelTransfer.mutateAsync(person.id);
      toast({ variant: 'success', title: 'Transfer cancelled' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to cancel transfer',
        description: error instanceof Error ? error.message : 'Something went wrong.',
      });
    }
  };

  const buildUpdates = (data: UpdateWorkerFormData): Record<string, unknown> => {
    const currentStart = data.checkInStart || null;
    const currentEnd = data.checkInEnd || null;
    const originalStart = person.check_in_start || null;
    const originalEnd = person.check_in_end || null;

    const scheduleTimeChanged = currentStart !== originalStart || currentEnd !== originalEnd;
    const workDaysChanged = (data.workDays || '') !== (person.work_days || '');

    const updates: Record<string, unknown> = {};
    if (data.firstName !== person.first_name) updates.firstName = data.firstName;
    if (data.lastName !== person.last_name) updates.lastName = data.lastName;
    if (data.role !== person.role) updates.role = data.role;
    if ((data.teamId ?? null) !== (person.team_id ?? null)) updates.teamId = data.teamId;
    if (data.isActive !== person.is_active) updates.isActive = data.isActive;
    if (workDaysChanged) updates.workDays = data.workDays || null;
    if (scheduleTimeChanged) {
      updates.checkInStart = currentStart;
      updates.checkInEnd = currentEnd;
    }
    return updates;
  };

  const submitUpdate = async (data: UpdateWorkerFormData) => {
    const updates = buildUpdates(data);

    if (Object.keys(updates).length === 0) {
      toast({ title: 'No changes', description: 'No modifications were detected.' });
      return;
    }

    try {
      await updatePerson.mutateAsync({
        personId: person.id,
        data: updates,
      });
      toast({
        variant: 'success',
        title: 'Worker updated',
        description: `${data.firstName} ${data.lastName} has been updated successfully.`,
      });
      navigate(ROUTES.ADMIN_WORKERS);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update worker',
        description: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      });
    }
  };

  const onSubmit = async (data: UpdateWorkerFormData) => {
    // Check if this is a team transfer (worker already has a team and team is changing)
    const teamChanging = (data.teamId ?? null) !== (person.team_id ?? null);
    const isTransfer = teamChanging && !!person.team_id && !!data.teamId;

    if (isTransfer) {
      // Show confirmation dialog — transfer takes effect next day
      setPendingFormData(data);
      setShowTransferConfirm(true);
      return;
    }

    await submitUpdate(data);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Worker"
        description={`Editing ${person.first_name} ${person.last_name}`}
        action={
          <Button variant="outline" onClick={() => navigate(ROUTES.ADMIN_WORKERS)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Workers
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Worker Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Pending Transfer Badge */}
            {person.effective_team && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
                <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-sm flex-1">
                  Transferring to <strong>{person.effective_team.name}</strong> on{' '}
                  {person.effective_transfer_date
                    ? formatDate(person.effective_transfer_date)
                    : 'next day'}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={cancelTransfer.isPending}
                  onClick={handleCancelTransfer}
                >
                  {cancelTransfer.isPending ? 'Cancelling...' : 'Cancel Transfer'}
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input value={person.email} disabled className="bg-muted" />
              <p className="text-sm text-muted-foreground">
                Email address cannot be changed
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="Enter first name"
                  {...register('firstName')}
                />
                {errors.firstName && (
                  <p className="text-sm text-destructive">{errors.firstName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Enter last name"
                  {...register('lastName')}
                />
                {errors.lastName && (
                  <p className="text-sm text-destructive">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={selectedRole}
                  onValueChange={(value) => {
                    setValue('role', value as 'WORKER' | 'TEAM_LEAD' | 'SUPERVISOR' | 'WHS' | 'ADMIN');
                    if (value !== 'WORKER' && value !== 'TEAM_LEAD') {
                      setValue('teamId', null);
                    }
                    // Clear schedule overrides when switching away from WORKER
                    if (value !== 'WORKER') {
                      setValue('workDays', '');
                      setValue('checkInStart', '');
                      setValue('checkInEnd', '');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WORKER">Worker</SelectItem>
                    <SelectItem value="TEAM_LEAD">Team Lead</SelectItem>
                    <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                    <SelectItem value="WHS">WHS Officer</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedRole === 'WORKER' || selectedRole === 'TEAM_LEAD' ? (
                <div className="space-y-2">
                  <Label htmlFor="teamId">Team {selectedRole === 'WORKER' && <span className="text-destructive">*</span>}</Label>
                  <Select
                    value={selectedRole === 'WORKER' ? (selectedTeamId || '') : (selectedTeamId || 'none')}
                    onValueChange={(value) => setValue('teamId', value === 'none' ? null : value, { shouldValidate: true })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedRole !== 'WORKER' && (
                        <SelectItem value="none">No Team</SelectItem>
                      )}
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.teamId && (
                    <p className="text-sm text-destructive">{errors.teamId.message}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Team Assignment</Label>
                  <p className="text-sm text-muted-foreground pt-2">
                    {selectedRole === 'SUPERVISOR'
                      ? 'Supervisor team assignments are managed in Team settings.'
                      : selectedRole === 'WHS'
                        ? 'WHS officers manage incident cases across all teams.'
                        : 'Admin accounts have access to all teams.'}
                  </p>
                </div>
              )}
            </div>

            {/* Worker Schedule Override */}
            {selectedRole === 'WORKER' && selectedTeamId && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Schedule Override (Optional)
                  </CardTitle>
                  <CardDescription>
                    Override team schedule for this worker. Clear to use team defaults.
                    {(() => {
                      const selectedTeam = teams.find(t => t.id === selectedTeamId);
                      return selectedTeam ? (
                        <div className="mt-2 text-sm">
                          <strong>Team default:</strong>{' '}
                          {formatWorkDays(selectedTeam.work_days) || 'Mon-Fri'} |{' '}
                          {selectedTeam.check_in_start} - {selectedTeam.check_in_end}
                        </div>
                      ) : null;
                    })()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Work Days Toggle */}
                  <div className="space-y-2">
                    <Label>Work Days</Label>
                    <div className="flex flex-wrap gap-2">
                      {WORK_DAYS_OPTIONS.map((day) => (
                        <Button
                          key={day.value}
                          type="button"
                          variant={selectedWorkDays.includes(day.value) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleWorkDay(day.value)}
                        >
                          {day.label.slice(0, 3)}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Deselect all to use team work days
                    </p>
                  </div>

                  {/* Check-in Time Override */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="checkInStart">Check-in Start</Label>
                      <Input
                        id="checkInStart"
                        type="time"
                        placeholder="Team default"
                        {...register('checkInStart')}
                      />
                      <p className="text-xs text-muted-foreground">
                        Clear to use team time
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="checkInEnd">Check-in End</Label>
                      <Input
                        id="checkInEnd"
                        type="time"
                        placeholder="Team default"
                        {...register('checkInEnd')}
                      />
                      <p className="text-xs text-muted-foreground">
                        Clear to use team time
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center space-x-4 rounded-lg border p-4">
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={(checked) => setValue('isActive', checked)}
              />
              <div className="space-y-0.5">
                <Label htmlFor="isActive" className="text-base">
                  Active Status
                </Label>
                <p className="text-sm text-muted-foreground">
                  {isActive
                    ? 'Worker can log in and submit check-ins'
                    : 'Worker is deactivated and cannot access the system'}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(ROUTES.ADMIN_WORKERS)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || updatePerson.isPending}>
                {updatePerson.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Transfer Confirmation Dialog */}
      <ConfirmDialog
        open={showTransferConfirm}
        onOpenChange={setShowTransferConfirm}
        title="Transfer Worker"
        description={`${person.first_name} ${person.last_name} will be transferred from ${person.team?.name ?? 'current team'} to ${teams.find(t => t.id === pendingFormData?.teamId)?.name ?? 'the new team'}. The transfer takes effect tomorrow.`}
        confirmLabel="Confirm Transfer"
        onConfirm={() => {
          if (pendingFormData) {
            submitUpdate(pendingFormData);
            setPendingFormData(null);
          }
        }}
      />
    </div>
  );
}
