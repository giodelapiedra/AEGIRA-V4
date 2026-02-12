import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Users, Clock, UserCheck, Eye, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useCreateTeam } from '@/features/team/hooks/useTeams';
import { useTeamLeads, useSupervisors } from '@/features/person/hooks/usePersons';
import { useToast } from '@/lib/hooks/use-toast';
import { ROUTES } from '@/config/routes.config';
import { WORK_DAYS_OPTIONS } from '@/types/team.types';

// Helper to compare HH:mm times
function isEndTimeAfterStart(start: string, end: string): boolean {
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  return endH * 60 + endM > startH * 60 + startM;
}

const timeRegex = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

const createTeamSchema = z
  .object({
    name: z.string().min(1, 'Team name is required').max(100),
    description: z.string().max(500).optional(),
    leaderId: z.string().min(1, 'Team leader is required'),
    supervisorId: z.string().optional().or(z.literal('')),
    checkInStart: z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
    checkInEnd: z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
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

type CreateTeamFormData = z.infer<typeof createTeamSchema>;

export function AdminTeamCreatePage() {
  const navigate = useNavigate();
  const createTeam = useCreateTeam();
  const { data: teamLeads = [], isLoading: loadingTeamLeads } = useTeamLeads();
  const { data: supervisors = [], isLoading: loadingSupervisors } = useSupervisors();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateTeamFormData>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: {
      name: '',
      description: '',
      leaderId: '',
      supervisorId: '',
      checkInStart: '06:00',
      checkInEnd: '10:00',
      workDays: ['1', '2', '3', '4', '5'], // Mon-Fri
    },
  });

  const selectedWorkDays = watch('workDays') || [];
  const selectedLeaderId = watch('leaderId');
  const selectedSupervisorId = watch('supervisorId');

  const noTeamLeads = !loadingTeamLeads && teamLeads.length === 0;

  const toggleWorkDay = (day: string) => {
    const current = selectedWorkDays;
    if (current.includes(day)) {
      setValue('workDays', current.filter((d) => d !== day), { shouldValidate: true });
    } else {
      setValue('workDays', [...current, day].sort(), { shouldValidate: true });
    }
  };

  const onSubmit = async (data: CreateTeamFormData) => {
    try {
      await createTeam.mutateAsync({
        name: data.name,
        description: data.description,
        leaderId: data.leaderId,
        supervisorId: data.supervisorId || null,
        checkInStart: data.checkInStart,
        checkInEnd: data.checkInEnd,
        workDays: data.workDays.join(','),
      });
      toast({
        variant: 'success',
        title: 'Team created',
        description: `${data.name} has been created successfully.`,
      });
      navigate(ROUTES.ADMIN_TEAMS);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to create team',
        description: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Team"
        description="Create a new team with check-in schedule"
        action={
          <Button variant="outline" onClick={() => navigate(ROUTES.ADMIN_TEAMS)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Teams
          </Button>
        }
      />

      {noTeamLeads && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No Team Leads Available</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <p>
              You need to create a worker with the <strong>Team Lead</strong> role before you can create a team.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => navigate(ROUTES.ADMIN_WORKERS_CREATE)}
            >
              Create a Team Lead
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
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

        {/* Team Leader */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Team Leader
            </CardTitle>
            <CardDescription>
              Assign a team lead to manage this team and monitor worker check-ins
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="leaderId">Team Leader <span className="text-destructive">*</span></Label>
              <Select
                value={selectedLeaderId || ''}
                onValueChange={(value) => setValue('leaderId', value)}
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
                The team leader will have access to view and monitor all worker check-ins for this team
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Supervisor Assignment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Supervisor Assignment
            </CardTitle>
            <CardDescription>
              Optionally assign a supervisor to oversee this team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="supervisorId">Supervisor (Optional)</Label>
              <Select
                value={selectedSupervisorId || '__none__'}
                onValueChange={(value) => setValue('supervisorId', value === '__none__' ? '' : value)}
                disabled={loadingSupervisors}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingSupervisors ? 'Loading...' : 'Select a supervisor (optional)'} />
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
                The supervisor will only see teams assigned to them in their dashboard
              </p>
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
            {/* Time Window */}
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

            {/* Work Days */}
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

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(ROUTES.ADMIN_TEAMS)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || createTeam.isPending || noTeamLeads}>
            {createTeam.isPending ? 'Creating...' : 'Create Team'}
          </Button>
        </div>
      </form>
    </div>
  );
}
