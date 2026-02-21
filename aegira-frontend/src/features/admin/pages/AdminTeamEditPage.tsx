import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Users, Clock, UserCheck, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageLoader } from '@/components/common/PageLoader';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { useTeam, useUpdateTeam } from '@/features/team/hooks/useTeams';
import { useTeamLeads, useSupervisors } from '@/features/person/hooks/usePersons';
import { useToast } from '@/lib/hooks/use-toast';
import { ROUTES } from '@/config/routes.config';
import { isEndTimeAfterStart, TIME_REGEX } from '@/lib/utils/format.utils';
import { WORK_DAYS_OPTIONS } from '@/types/team.types';
import type { Team } from '@/types/team.types';
import type { Person } from '@/types/person.types';

const updateTeamSchema = z
  .object({
    name: z.string().min(1, 'Team name is required').max(100),
    description: z.string().max(500).optional(),
    leaderId: z.string().min(1, 'Team leader is required'),
    supervisorId: z.string().optional().or(z.literal('')),
    isActive: z.boolean(),
    checkInStart: z.string().regex(TIME_REGEX, 'Invalid time format (HH:MM)'),
    checkInEnd: z.string().regex(TIME_REGEX, 'Invalid time format (HH:MM)'),
    workDays: z.array(z.string()).min(1, 'Select at least one work day'),
  })
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

type UpdateTeamFormData = z.infer<typeof updateTeamSchema>;

export function AdminTeamEditPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { data: team, isLoading, error } = useTeam(teamId || '');
  const { data: teamLeads = [], isLoading: loadingTeamLeads } = useTeamLeads(teamId);
  const { data: supervisors = [], isLoading: loadingSupervisors } = useSupervisors();

  if (!team && !isLoading) {
    return <ErrorMessage message="Team not found" />;
  }

  const allLoading = isLoading || loadingTeamLeads || loadingSupervisors;

  return (
    <PageLoader isLoading={allLoading} error={error} skeleton="form">
      {team && (
        <TeamEditForm
          team={team}
          teamLeads={teamLeads}
          supervisors={supervisors}
          loadingTeamLeads={loadingTeamLeads}
          loadingSupervisors={loadingSupervisors}
        />
      )}
    </PageLoader>
  );
}

interface TeamEditFormProps {
  team: Team;
  teamLeads: Person[];
  supervisors: Person[];
  loadingTeamLeads: boolean;
  loadingSupervisors: boolean;
}

function TeamEditForm({ team, teamLeads, supervisors, loadingTeamLeads, loadingSupervisors }: TeamEditFormProps) {
  const navigate = useNavigate();
  const updateTeam = useUpdateTeam();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UpdateTeamFormData>({
    resolver: zodResolver(updateTeamSchema),
    defaultValues: {
      name: team.name,
      description: team.description || '',
      leaderId: team.leader_id || '',
      supervisorId: team.supervisor_id || '',
      isActive: team.is_active,
      checkInStart: team.check_in_start || '06:00',
      checkInEnd: team.check_in_end || '10:00',
      workDays: team.work_days ? team.work_days.split(',') : ['1', '2', '3', '4', '5'],
    },
  });

  const isActive = watch('isActive');
  const selectedWorkDays = watch('workDays') || [];
  const selectedLeaderId = watch('leaderId') || '';
  const selectedSupervisorId = watch('supervisorId') || '';

  const toggleWorkDay = (day: string) => {
    const current = selectedWorkDays;
    if (current.includes(day)) {
      setValue('workDays', current.filter((d) => d !== day), { shouldValidate: true });
    } else {
      setValue('workDays', [...current, day].sort(), { shouldValidate: true });
    }
  };

  const onSubmit = async (data: UpdateTeamFormData) => {
    // Only send fields that actually changed
    const workDaysStr = data.workDays.join(',');
    const updates: Record<string, unknown> = {};

    if (data.name !== team.name) updates.name = data.name;
    if ((data.description || '') !== (team.description || '')) updates.description = data.description;
    if (data.leaderId !== (team.leader_id || '')) updates.leaderId = data.leaderId;
    if ((data.supervisorId || null) !== (team.supervisor_id || null)) updates.supervisorId = data.supervisorId || null;
    if (data.isActive !== team.is_active) updates.isActive = data.isActive;
    if (workDaysStr !== (team.work_days || '1,2,3,4,5')) updates.workDays = workDaysStr;

    // Always send both time fields together to ensure backend validation runs
    const startChanged = data.checkInStart !== (team.check_in_start || '06:00');
    const endChanged = data.checkInEnd !== (team.check_in_end || '10:00');
    if (startChanged || endChanged) {
      updates.checkInStart = data.checkInStart;
      updates.checkInEnd = data.checkInEnd;
    }

    if (Object.keys(updates).length === 0) {
      toast({ variant: 'warning', title: 'No changes', description: 'No modifications were detected.' });
      return;
    }

    try {
      await updateTeam.mutateAsync({
        teamId: team.id,
        data: updates,
      });
      toast({
        variant: 'success',
        title: 'Team updated',
        description: `${data.name} has been updated successfully.`,
      });
      navigate(ROUTES.ADMIN_TEAMS);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update team',
        description: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Team"
        description={`Editing ${team.name}`}
        action={
          <Button variant="outline" onClick={() => navigate(ROUTES.ADMIN_TEAMS)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Teams
          </Button>
        }
      />

      {!team.is_active && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <p className="font-medium text-destructive">This team is deactivated</p>
            <p className="text-sm text-muted-foreground">
              All members were unassigned when this team was deactivated. Toggle the Active Status below to reactivate.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Team Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Team Name</Label>
              <Input
                id="name"
                placeholder="Enter team name"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Enter team description"
                rows={3}
                {...register('description')}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Leadership */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Leadership
            </CardTitle>
            <CardDescription>
              Assign a team leader and optionally a supervisor to this team
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="leaderId">Team Leader <span className="text-destructive">*</span></Label>
                <Select
                  value={selectedLeaderId}
                  onValueChange={(value) => setValue('leaderId', value, { shouldValidate: true })}
                  disabled={loadingTeamLeads}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingTeamLeads ? 'Loading...' : 'Select a team lead'} />
                  </SelectTrigger>
                  <SelectContent>
                    {teamLeads.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.first_name} {lead.last_name} ({lead.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.leaderId && (
                  <p className="text-sm text-destructive">{errors.leaderId.message}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  Can view and monitor all worker check-ins
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supervisorId">Supervisor (Optional)</Label>
                <Select
                  value={selectedSupervisorId || '__none__'}
                  onValueChange={(value) => setValue('supervisorId', value === '__none__' ? '' : value, { shouldValidate: true })}
                  disabled={loadingSupervisors}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingSupervisors ? 'Loading...' : 'Select a supervisor'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {supervisors.map((sup) => (
                      <SelectItem key={sup.id} value={sup.id}>
                        {sup.first_name} {sup.last_name} ({sup.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Only sees teams assigned to them
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Check-in Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Check-in Schedule
            </CardTitle>
            <CardDescription>
              Set the check-in window and work days for this team
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="checkInStart">Check-in Start Time</Label>
                <Input
                  id="checkInStart"
                  type="time"
                  {...register('checkInStart')}
                />
                {errors.checkInStart && (
                  <p className="text-sm text-destructive">{errors.checkInStart.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="checkInEnd">Check-in End Time</Label>
                <Input
                  id="checkInEnd"
                  type="time"
                  {...register('checkInEnd')}
                />
                {errors.checkInEnd && (
                  <p className="text-sm text-destructive">{errors.checkInEnd.message}</p>
                )}
              </div>
            </div>

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
              {errors.workDays && (
                <p className="text-sm text-destructive">{errors.workDays.message}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Workers in this team are expected to check in on selected days
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Active Status — outside cards, matches Worker Edit pattern */}
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
                ? 'Team is active and visible in the system'
                : 'Team is deactivated and hidden from selections'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(ROUTES.ADMIN_TEAMS)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || updateTeam.isPending}>
            {updateTeam.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
