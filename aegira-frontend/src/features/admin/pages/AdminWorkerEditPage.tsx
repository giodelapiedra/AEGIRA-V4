import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, UserCog } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { usePerson, useUpdatePerson } from '@/features/person/hooks/usePersons';
import { useTeams } from '@/features/team/hooks/useTeams';
import { useToast } from '@/lib/hooks/use-toast';
import { ROUTES } from '@/config/routes.config';
import type { Person } from '@/types/person.types';
import type { Team } from '@/types/team.types';

const updateWorkerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  role: z.enum(['WORKER', 'TEAM_LEAD', 'SUPERVISOR', 'WHS', 'ADMIN']),
  teamId: z.string().nullable().optional(),
  isActive: z.boolean(),
});

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
      {person && <WorkerEditForm person={person} teams={teamsData?.items || []} />}
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
  const { toast } = useToast();

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
    },
  });

  const selectedRole = watch('role');
  const selectedTeamId = watch('teamId');
  const isActive = watch('isActive');

  const onSubmit = async (data: UpdateWorkerFormData) => {
    // Only send fields that actually changed
    const updates = {
      ...(data.firstName !== person.first_name && { firstName: data.firstName }),
      ...(data.lastName !== person.last_name && { lastName: data.lastName }),
      ...((data.teamId ?? null) !== (person.team_id ?? null) && { teamId: data.teamId }),
      ...(data.isActive !== person.is_active && { isActive: data.isActive }),
    };

    if (Object.keys(updates).length === 0) {
      toast({ title: 'No changes', description: 'No modifications were detected.' });
      navigate(ROUTES.ADMIN_WORKERS);
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
                <p className="text-sm text-muted-foreground">
                  Role changes are handled through the Roles management page
                </p>
              </div>

              {selectedRole === 'WORKER' || selectedRole === 'TEAM_LEAD' ? (
                <div className="space-y-2">
                  <Label htmlFor="teamId">Team</Label>
                  <Select
                    value={selectedTeamId || 'none'}
                    onValueChange={(value) => setValue('teamId', value === 'none' ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Team</SelectItem>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
    </div>
  );
}
