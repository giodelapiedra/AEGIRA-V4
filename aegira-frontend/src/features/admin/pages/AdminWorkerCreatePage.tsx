import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const createWorkerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  role: z.enum(['WORKER', 'TEAM_LEAD', 'SUPERVISOR', 'WHS', 'ADMIN']),
  teamId: z.string().optional(),
}).refine(
  (data) => data.role !== 'WORKER' || (data.teamId && data.teamId.length > 0),
  { message: 'Team is required for workers', path: ['teamId'] }
);

type CreateWorkerFormData = z.infer<typeof createWorkerSchema>;

export function AdminWorkerCreatePage() {
  const navigate = useNavigate();
  const createPerson = useCreatePerson();
  const { data: teamsData } = useTeams(1, 100);
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
    },
  });

  const selectedRole = watch('role');
  const selectedTeamId = watch('teamId');

  const onSubmit = async (data: CreateWorkerFormData) => {
    try {
      await createPerson.mutateAsync(data);
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
                    if (value !== 'WORKER') {
                      setValue('teamId', undefined);
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

              {selectedRole === 'WORKER' ? (
                <div className="space-y-2">
                  <Label htmlFor="teamId">Team <span className="text-destructive">*</span></Label>
                  <Select
                    value={selectedTeamId || ''}
                    onValueChange={(value) => setValue('teamId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
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
                    {selectedRole === 'TEAM_LEAD'
                      ? 'Team lead assignments are managed in Team settings.'
                      : selectedRole === 'SUPERVISOR'
                        ? 'Supervisor team assignments are managed in Team settings.'
                        : selectedRole === 'WHS'
                          ? 'WHS accounts manage incidents and cases across all teams.'
                          : 'Admin accounts have access to all teams.'}
                  </p>
                </div>
              )}
            </div>

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
