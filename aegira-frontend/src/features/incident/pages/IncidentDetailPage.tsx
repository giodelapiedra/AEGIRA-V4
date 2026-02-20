import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IncidentStatusBadge } from '../components/IncidentStatusBadge';
import { SeverityBadge } from '../components/SeverityBadge';
import { CaseStatusBadge } from '../components/CaseStatusBadge';
import { IncidentTimeline } from '../components/IncidentTimeline';
import { RejectionDialog } from '../components/RejectionDialog';
import { useIncident } from '../hooks/useIncident';
import { useIncidentTimeline } from '../hooks/useIncidentTimeline';
import { useApproveIncident } from '../hooks/useApproveIncident';
import { useToast } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { formatDate, formatDateTime } from '@/lib/utils/date.utils';
import {
  formatIncidentNumber,
  formatCaseNumber,
  formatIncidentType,
  formatRejectionReason,
  formatGender,
} from '@/lib/utils/format.utils';
import { ROUTES } from '@/config/routes.config';
import { buildRoute } from '@/lib/utils/route.utils';

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

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const { data: incident, isLoading, error } = useIncident(id || '');
  const { data: timeline } = useIncidentTimeline(id || '');
  const approveIncident = useApproveIncident();

  const isWhs = user?.role === 'WHS';
  const isPending = incident?.status === 'PENDING';

  const handleApprove = async () => {
    if (!id) return;
    try {
      await approveIncident.mutateAsync(id);
      toast({
        variant: 'success',
        title: 'Incident approved',
        description: 'A case has been created for this incident.',
      });
      setApproveDialogOpen(false);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to approve',
        description: err instanceof Error ? err.message : 'Something went wrong.',
      });
    }
  };

  const backRoute = isWhs ? ROUTES.WHS_INCIDENTS : ROUTES.MY_INCIDENTS;

  return (
    <>
    {/* Header - renders immediately for fast LCP */}
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Incident Details</h1>
        {incident && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground">
              {incident.reporterName}
            </span>
            <SeverityBadge severity={incident.severity} />
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        {incident && <IncidentStatusBadge status={incident.status} />}
        <Button variant="outline" onClick={() => navigate(backRoute)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
    </div>
    <PageLoader isLoading={isLoading} error={error} skeleton="detail-content">
      {incident && (
        <div className="space-y-6">
          {/* 2x2 Quadrant Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top-left: INCIDENT INFORMATION */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Incident Information
                </h3>
                <InfoRow
                  label="Incident #"
                  value={formatIncidentNumber(incident.incidentNumber, incident.createdAt)}
                />
                <InfoRow
                  label="Status"
                  value={<IncidentStatusBadge status={incident.status} />}
                />
                <InfoRow
                  label="Severity"
                  value={<SeverityBadge severity={incident.severity} />}
                />
                <InfoRow
                  label="Incident Type"
                  value={formatIncidentType(incident.incidentType)}
                />
                <InfoRow
                  label="Created"
                  value={formatDate(incident.createdAt)}
                />
              </CardContent>
            </Card>

            {/* Top-right: REPORTER INFORMATION */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Reporter Information
                </h3>
                <InfoRow label="Name" value={incident.reporterName} />
                <InfoRow
                  label="Age"
                  value={incident.reporterAge != null ? `${incident.reporterAge} years old` : 'Not specified'}
                />
                <InfoRow label="Gender" value={formatGender(incident.reporterGender)} />
                <InfoRow label="Email" value={incident.reporterEmail} />
                <InfoRow label="Team" value={incident.teamName} />
                <InfoRow
                  label="Location"
                  value={incident.location || 'Not specified'}
                />
              </CardContent>
            </Card>

            {/* Bottom-left: INCIDENT DETAILS */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Incident Details
                </h3>
                <InfoRow label="Title" value={incident.title} />
                <div className="pt-2.5">
                  <span className="text-sm text-muted-foreground">Description:</span>
                  <p className="text-sm mt-1.5 whitespace-pre-wrap leading-relaxed">
                    {incident.description}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Bottom-right: WHS REVIEW */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  WHS Review
                </h3>
                <InfoRow
                  label="Reviewed By"
                  value={incident.reviewerName || 'Pending Review'}
                />
                <InfoRow
                  label="Reviewed At"
                  value={incident.reviewedAt ? formatDateTime(incident.reviewedAt) : '-'}
                />
                {incident.status === 'APPROVED' && incident.caseNumber && (
                  <>
                    <InfoRow
                      label="Case #"
                      value={formatCaseNumber(incident.caseNumber, incident.createdAt)}
                    />
                    <InfoRow
                      label="Case Status"
                      value={
                        incident.caseStatus ? (
                          <CaseStatusBadge status={incident.caseStatus} />
                        ) : (
                          '-'
                        )
                      }
                    />
                    {incident.caseNotes ? (
                      <div className="pt-2.5">
                        <span className="text-sm text-muted-foreground">Notes:</span>
                        <p className="text-sm mt-1.5 whitespace-pre-wrap leading-relaxed">
                          {incident.caseNotes}
                        </p>
                      </div>
                    ) : (
                      <InfoRow label="Notes" value="No notes yet" />
                    )}
                    {isWhs && incident.caseId && (
                      <div className="pt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => navigate(buildRoute(ROUTES.WHS_CASE_DETAIL, { id: incident.caseId! }))}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View Full Case
                        </Button>
                      </div>
                    )}
                  </>
                )}
                {incident.status === 'REJECTED' && (
                  <>
                    {incident.rejectionReason && (
                      <InfoRow
                        label="Reason"
                        value={formatRejectionReason(incident.rejectionReason)}
                      />
                    )}
                    {incident.rejectionExplanation && (
                      <div className="pt-2.5">
                        <span className="text-sm text-muted-foreground">Explanation:</span>
                        <p className="text-sm mt-1.5 leading-relaxed">
                          {incident.rejectionExplanation}
                        </p>
                      </div>
                    )}
                  </>
                )}
                {incident.status === 'PENDING' && (
                  <div className="mt-2">
                    <Badge variant="warning" className="uppercase tracking-wider">
                      Pending Review
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* WHS Actions (if PENDING) — Admin is view-only */}
          {isWhs && isPending && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <Button onClick={() => setApproveDialogOpen(true)}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setRejectDialogOpen(true)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
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

          {/* Dialogs */}
          <ConfirmDialog
            open={approveDialogOpen}
            onOpenChange={setApproveDialogOpen}
            title="Approve Incident"
            description="This will approve the incident and create a new case. Are you sure?"
            confirmLabel="Approve"
            onConfirm={handleApprove}
            isLoading={approveIncident.isPending}
          />

          <RejectionDialog
            open={rejectDialogOpen}
            onOpenChange={setRejectDialogOpen}
            incidentId={id || ''}
          />
        </div>
      )}
    </PageLoader>
    </>
  );
}
