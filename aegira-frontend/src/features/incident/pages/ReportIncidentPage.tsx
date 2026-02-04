import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useCreateIncident } from '../hooks/useCreateIncident';
import { useToast } from '@/lib/hooks/use-toast';
import { ROUTES } from '@/config/routes.config';

const INCIDENT_TYPE_OPTIONS = [
  { value: 'PHYSICAL_INJURY', label: 'Physical Injury' },
  { value: 'ILLNESS_SICKNESS', label: 'Illness / Sickness' },
  { value: 'MENTAL_HEALTH', label: 'Mental Health' },
  { value: 'MEDICAL_EMERGENCY', label: 'Medical Emergency' },
  { value: 'HEALTH_SAFETY_CONCERN', label: 'Health & Safety Concern' },
  { value: 'OTHER', label: 'Other' },
] as const;

const SEVERITY_OPTIONS = [
  { value: 'LOW', label: 'Low', description: 'Minor issue, no immediate danger' },
  { value: 'MEDIUM', label: 'Medium', description: 'Moderate concern, needs attention' },
  { value: 'HIGH', label: 'High', description: 'Serious issue, urgent attention required' },
  { value: 'CRITICAL', label: 'Critical', description: 'Life-threatening or severe emergency' },
] as const;

const createIncidentSchema = z.object({
  incidentType: z.enum(
    ['PHYSICAL_INJURY', 'ILLNESS_SICKNESS', 'MENTAL_HEALTH', 'MEDICAL_EMERGENCY', 'HEALTH_SAFETY_CONCERN', 'OTHER'],
    { required_error: 'Please select an incident type' }
  ),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], {
    required_error: 'Please select a severity level',
  }),
  title: z.string().min(1, 'Title is required').max(200),
  location: z.string().max(200).optional(),
  description: z.string().min(1, 'Description is required').max(2000),
});

type CreateIncidentFormData = z.infer<typeof createIncidentSchema>;

export function ReportIncidentPage() {
  const navigate = useNavigate();
  const createIncident = useCreateIncident();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateIncidentFormData>({
    resolver: zodResolver(createIncidentSchema),
    defaultValues: {
      incidentType: undefined,
      severity: undefined,
      title: '',
      location: '',
      description: '',
    },
  });

  const selectedType = watch('incidentType');
  const selectedSeverity = watch('severity');

  const onSubmit = async (data: CreateIncidentFormData) => {
    try {
      await createIncident.mutateAsync(data);
      toast({
        variant: 'success',
        title: 'Incident report submitted',
        description: 'Your incident report has been submitted and is pending review.',
      });
      navigate(ROUTES.MY_INCIDENTS);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to submit incident',
        description:
          error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Incident"
        description="Submit a workplace incident report"
        action={
          <Button variant="outline" onClick={() => navigate(ROUTES.MY_INCIDENTS)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to My Incidents
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Incident Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>
                  Incident Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedType || ''}
                  onValueChange={(value) =>
                    setValue('incidentType', value as CreateIncidentFormData['incidentType'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select incident type" />
                  </SelectTrigger>
                  <SelectContent>
                    {INCIDENT_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.incidentType && (
                  <p className="text-sm text-destructive">{errors.incidentType.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>
                  Severity <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedSeverity || ''}
                  onValueChange={(value) =>
                    setValue('severity', value as CreateIncidentFormData['severity'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select severity level" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div>
                          <span>{opt.label}</span>
                          <span className="ml-2 text-muted-foreground text-xs">
                            — {opt.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.severity && (
                  <p className="text-sm text-destructive">{errors.severity.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="Brief summary of the incident"
                {...register('title')}
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location (Optional)</Label>
              <Input
                id="location"
                placeholder="Where did the incident occur?"
                {...register('location')}
              />
              {errors.location && (
                <p className="text-sm text-destructive">{errors.location.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Provide a detailed description of the incident..."
                rows={5}
                {...register('description')}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Include what happened, when it occurred, and any relevant details.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(ROUTES.MY_INCIDENTS)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || createIncident.isPending}>
            {createIncident.isPending ? 'Submitting...' : 'Submit Incident Report'}
          </Button>
        </div>
      </form>
    </div>
  );
}
