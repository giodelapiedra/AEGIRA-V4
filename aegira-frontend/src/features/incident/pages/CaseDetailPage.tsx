import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ExternalLink, ShieldCheck } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CaseStatusBadge } from '../components/CaseStatusBadge';
import { SeverityBadge } from '../components/SeverityBadge';
import { IncidentTimeline } from '../components/IncidentTimeline';
import { useCase } from '../hooks/useCase';
import { useUpdateCase } from '../hooks/useUpdateCase';
import { useIncidentTimeline } from '../hooks/useIncidentTimeline';
import { useToast } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { formatDate, formatDateTime } from '@/lib/utils/date.utils';
import {
  formatCaseNumber,
  formatIncidentNumber,
  formatIncidentType,
  formatGender,
} from '@/lib/utils/format.utils';
import { ROUTES } from '@/config/routes.config';
import { buildRoute } from '@/lib/utils/route.utils';
import type { CaseStatus } from '@/types/incident.types';

const VALID_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  OPEN: ['INVESTIGATING', 'RESOLVED', 'CLOSED'],
  INVESTIGATING: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

const STATUS_LABELS: Record<CaseStatus, string> = {
  OPEN: 'Open',
  INVESTIGATING: 'Investigating',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const updateCaseSchema = z.object({
  status: z.enum(['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED']).optional(),
  notes: z.string().max(2000).optional(),
});

type UpdateCaseFormData = z.infer<typeof updateCaseSchema>;

/** Key-value row used inside each quadrant card */
interface InfoRowProps {
  label: string;
  value: React.ReactNode;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}:</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isWhs = user?.role === 'WHS';

  const { data: caseData, isLoading, error } = useCase(id || '');
  const { data: timeline } = useIncidentTimeline(caseData?.incidentId || '');
  const updateCase = useUpdateCase();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { isDirty },
  } = useForm<UpdateCaseFormData>({
    resolver: zodResolver(updateCaseSchema),
    values: {
      status: caseData?.status,
      notes: caseData?.notes || '',
    },
  });

  const selectedStatus = watch('status');

  const availableTransitions = caseData
    ? VALID_TRANSITIONS[caseData.status] || []
    : [];

  const onSubmit = async (data: UpdateCaseFormData) => {
    if (!id) return;
    try {
      await updateCase.mutateAsync({
        caseId: id,
        data: {
          ...(data.status && data.status !== caseData?.status && { status: data.status }),
          ...(data.notes !== undefined && { notes: data.notes }),
        },
      });
      toast({
        variant: 'success',
        title: 'Case updated',
        description: 'The case has been updated successfully.',
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to update case',
        description: err instanceof Error ? err.message : 'Something went wrong.',
      });
    }
  };

  return (
    <>
    {/* Header - renders immediately for fast LCP */}
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Case Details</h1>
        {caseData && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground">
              {caseData.incident.reporterName}
            </span>
            <SeverityBadge severity={caseData.incident.severity} />
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        {caseData && <CaseStatusBadge status={caseData.status} />}
        <Button variant="outline" onClick={() => navigate(ROUTES.WHS_CASES)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
    </div>
    <PageLoader isLoading={isLoading} error={error} skeleton="detail-content">
      {caseData && (
        <div className="space-y-6">
          {/* 2x2 Quadrant Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top-left: CASE INFORMATION */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Case Information
                </h3>
                <InfoRow
                  label="Case #"
                  value={formatCaseNumber(caseData.caseNumber, caseData.createdAt)}
                />
                <InfoRow
                  label="Status"
                  value={<CaseStatusBadge status={caseData.status} />}
                />
                <InfoRow
                  label="Severity"
                  value={<SeverityBadge severity={caseData.incident.severity} />}
                />
                <InfoRow
                  label="Incident Type"
                  value={formatIncidentType(caseData.incident.incidentType)}
                />
                <InfoRow
                  label="Created"
                  value={formatDate(caseData.createdAt)}
                />
                {caseData.resolvedAt && (
                  <InfoRow
                    label="Resolved"
                    value={formatDateTime(caseData.resolvedAt)}
                  />
                )}
              </CardContent>
            </Card>

            {/* Top-right: REPORTER INFORMATION */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Reporter Information
                </h3>
                <InfoRow label="Name" value={caseData.incident.reporterName} />
                <InfoRow
                  label="Age"
                  value={caseData.incident.reporterAge != null ? `${caseData.incident.reporterAge} years old` : 'Not specified'}
                />
                <InfoRow label="Gender" value={formatGender(caseData.incident.reporterGender)} />
                <InfoRow label="Email" value={caseData.incident.reporterEmail} />
                <InfoRow label="Team" value={caseData.incident.teamName} />
                {caseData.incident.location && (
                  <InfoRow label="Location" value={caseData.incident.location} />
                )}
                <div className="pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(buildRoute(ROUTES.WHS_INCIDENT_DETAIL, { id: caseData.incident.id }))}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View Incident {formatIncidentNumber(caseData.incident.incidentNumber, caseData.incident.createdAt)}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Bottom-left: INCIDENT DETAILS */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Incident Details
                </h3>
                <InfoRow label="Title" value={caseData.incident.title} />
                <div className="pt-2.5">
                  <span className="text-sm text-muted-foreground">Description:</span>
                  <p className="text-sm mt-1.5 whitespace-pre-wrap leading-relaxed">
                    {caseData.incident.description}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Bottom-right: WHS ASSIGNMENT */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  WHS Assignment
                </h3>
                <InfoRow
                  label="WHS Officer"
                  value={caseData.assigneeName ?? 'Unassigned'}
                />
                {caseData.notes ? (
                  <div className="pt-2.5">
                    <span className="text-sm text-muted-foreground">Notes:</span>
                    <p className="text-sm mt-1.5 whitespace-pre-wrap leading-relaxed">
                      {caseData.notes}
                    </p>
                  </div>
                ) : (
                  <InfoRow label="Notes" value="No notes yet" />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Manage Case — WHS only, Admin is view-only */}
          {isWhs && (
            <Card>
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                  Manage Case
                </CardTitle>
                <CardDescription>
                  Update status and keep internal notes for this case.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  {availableTransitions.length > 0 ? (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Status</Label>
                      <Select
                        value={selectedStatus || caseData.status}
                        onValueChange={(value) =>
                          setValue('status', value as CaseStatus, { shouldDirty: true })
                        }
                      >
                        <SelectTrigger className="w-full sm:max-w-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={caseData.status}>
                            {STATUS_LABELS[caseData.status]} (Current)
                          </SelectItem>
                          {availableTransitions.map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Current status: <span className="font-medium">{STATUS_LABELS[caseData.status]}</span>
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      This case is {caseData.status.toLowerCase()} and cannot be
                      transitioned further.
                    </p>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
                    <Textarea
                      id="notes"
                      placeholder="Add case notes..."
                      rows={5}
                      className="min-h-[140px] resize-y"
                      {...register('notes')}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use notes for investigation updates and handoff context.
                    </p>
                  </div>

                  <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate(ROUTES.WHS_CASES)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={updateCase.isPending || !isDirty}
                    >
                      {updateCase.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          {timeline && timeline.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Timeline
                </h3>
                <IncidentTimeline events={timeline} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </PageLoader>
    </>
  );
}
