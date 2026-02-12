import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, UserPlus, Calendar } from 'lucide-react';
import { isEndTimeAfterStart, TIME_REGEX, WORK_DAYS_REGEX } from '@/lib/utils/format.utils';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreatePerson } from '@/features/person/hooks/usePersons';
import { useTeams } from '@/features/team/hooks/useTeams';
import { useToast } from '@/lib/hooks/use-toast';
import { ROUTES } from '@/config/routes.config';
import { WORK_DAYS_OPTIONS } from '@/types/team.types';

const createWorkerSchema = z
  .object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    firstName: z.string().min(1, 'First name is required').max(100),
    lastName: z.string().min(1, 'Last name is required').max(100),
    role: z.enum(['WORKER', 'TEAM_LEAD', 'SUPERVISOR', 'WHS', 'ADMIN']),
    teamId: z.string().optional(),
    // Worker schedule override (optional)
    workDays: z.string().regex(WORK_DAYS_REGEX, 'Invalid work days format').optional().or(z.literal('')),
    checkInStart: z.string().regex(TIME_REGEX, 'Invalid time format (HH:MM)').optional().or(z.literal('')),
    checkInEnd: z.string().regex(TIME_REGEX, 'Invalid time format (HH:MM)').optional().or(z.literal('')),
  })
  .refine(
    (data) => data.role !== 'WORKER' || (data.teamId && data.teamId.length > 0),
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

type CreateWorkerFormData = z.infer<typeof createWorkerSchema>;

export function AdminWorkerCreatePage() {
  const navigate = useNavigate();
  const createPerson = useCreatePerson();
  const { data: teamsData, isLoading: isLoadingTeams } = useTeams(1, 100);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkerFormData>({
    resolver: zodResolver(createWorkerSchema),
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      teamId: '',
      role: 'WORKER',
      workDays: '',
      checkInStart: '',
      checkInEnd: '',
    },
  });

  const selectedRole = watch('role');
  const selectedTeamId = watch('teamId');
  const workDaysValue = watch('workDays') || '';
  const selectedWorkDays = workDaysValue ? workDaysValue.split(',').filter(Boolean) : [];

  const toggleWorkDay = (dayValue: string) => {
    const newSelection = selectedWorkDays.includes(dayValue)
      ? selectedWorkDays.filter((d) => d !== dayValue)
      : [...selectedWorkDays, dayValue].sort();

    setValue('workDays', newSelection.length > 0 ? newSelection.join(',') : '', { shouldValidate: true });
  };

  const onSubmit = async (data: CreateWorkerFormData) => {
    // Strip empty string schedule fields — backend expects omitted, not empty
    const payload = {
      ...data,
      workDays: data.workDays || undefined,
      checkInStart: data.checkInStart || undefined,
      checkInEnd: data.checkInEnd || undefined,
      teamId: data.teamId || undefined,
    };

    try {
      await createPerson.mutateAsync(payload);
      toast({
        variant: 'success',
        title: 'Worker created',
        description: `${data.firstName} ${data.lastName} has been added successfully.`,
      });
      navigate(ROUTES.ADMIN_WORKERS);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to create worker',
        description: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      });
    }
  };

  const teams = teamsData?.items || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Worker"
        description="Create a new worker account"
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
            <UserPlus className="h-5 w-5" />
            Worker Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="worker@company.com"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimum 8 characters"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
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
                      setValue('teamId', undefined);
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
                    <SelectItem value="WHS">WHS</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
                {errors.role && (
                  <p className="text-sm text-destructive">{errors.role.message}</p>
                )}
              </div>

              {selectedRole === 'WORKER' || selectedRole === 'TEAM_LEAD' ? (
                <div className="space-y-2">
                  <Label htmlFor="teamId">
                    Team {selectedRole === 'WORKER' && <span className="text-destructive">*</span>}
                  </Label>
                  <Select
                    value={selectedTeamId || 'none'}
                    onValueChange={(value) => setValue('teamId', value === 'none' ? undefined : value)}
                    disabled={isLoadingTeams}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingTeams ? 'Loading teams...' : 'Select team'} />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedRole === 'TEAM_LEAD' && (
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
                        ? 'WHS accounts manage incidents and cases across all teams.'
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
                    Override team schedule for this worker. Leave blank to use team defaults.
                    {(() => {
                      const selectedTeam = teams.find(t => t.id === selectedTeamId);
                      return selectedTeam ? (
                        <div className="mt-2 text-sm">
                          <strong>Team default:</strong>{' '}
                          {selectedTeam.work_days || 'Mon-Fri'} |{' '}
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
                      Leave unselected to use team work days
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
                        Leave blank to use team time
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
                        Leave blank to use team time
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(ROUTES.ADMIN_WORKERS)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || createPerson.isPending}>
                {createPerson.isPending ? 'Creating...' : 'Create Worker'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
