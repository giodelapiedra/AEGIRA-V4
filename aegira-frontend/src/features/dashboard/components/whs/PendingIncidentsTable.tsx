import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Eye, ThumbsUp, ThumbsDown, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { SeverityBadge } from '@/features/incident/components/SeverityBadge';
import { RejectionDialog } from '@/features/incident/components/RejectionDialog';
import { useApproveIncident } from '@/features/incident/hooks/useApproveIncident';
import { useToast } from '@/lib/hooks/use-toast';
import { ROUTES } from '@/config/routes.config';
import { buildRoute } from '@/lib/utils/route.utils';
import { formatIncidentNumber, formatIncidentType } from '@/lib/utils/format.utils';
import { getRelativeTime } from '@/lib/utils/date.utils';
import type { PendingIncidentRow } from '@/types/whs-dashboard.types';

interface PendingIncidentsTableProps {
  incidents: PendingIncidentRow[];
}

export function PendingIncidentsTable({ incidents }: PendingIncidentsTableProps) {
  const navigate = useNavigate();
  const approveIncident = useApproveIncident();
  const { toast } = useToast();

  const [approveTarget, setApproveTarget] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  const handleApprove = async () => {
    if (!approveTarget) return;
    try {
      await approveIncident.mutateAsync(approveTarget);
      toast({
        variant: 'success',
        title: 'Incident approved',
        description: 'A case has been created for this incident.',
      });
      setApproveTarget(null);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to approve',
        description: err instanceof Error ? err.message : 'Something went wrong.',
      });
    }
  };

  if (incidents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Incidents</CardTitle>
          <CardDescription>Incidents awaiting your review</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<CheckCircle className="h-12 w-12" />}
            title="No pending incidents"
            description="All incidents have been reviewed"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Pending Incidents</CardTitle>
          <CardDescription>Top {incidents.length} incidents sorted by severity</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Incident #</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Reporter</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.map((incident) => (
                <TableRow key={incident.id}>
                  <TableCell className="font-mono text-sm">
                    {formatIncidentNumber(incident.incidentNumber, incident.createdAt)}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate font-medium">
                    {incident.title}
                  </TableCell>
                  <TableCell>{incident.reporterName}</TableCell>
                  <TableCell className="text-sm">
                    {formatIncidentType(incident.incidentType)}
                  </TableCell>
                  <TableCell>
                    <SeverityBadge severity={incident.severity} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {getRelativeTime(incident.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          navigate(buildRoute(ROUTES.ADMIN_INCIDENT_DETAIL, { id: incident.id }))
                        }
                        aria-label={`View incident ${incident.incidentNumber}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => setApproveTarget(incident.id)}
                        aria-label={`Approve incident ${incident.incidentNumber}`}
                      >
                        <ThumbsUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setRejectTarget(incident.id)}
                        aria-label={`Reject incident ${incident.incidentNumber}`}
                      >
                        <ThumbsDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="justify-center border-t py-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => navigate(`${ROUTES.ADMIN_INCIDENTS}?status=PENDING`)}
          >
            View all pending incidents
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>

      {/* Approve confirmation dialog */}
      <ConfirmDialog
        open={!!approveTarget}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        title="Approve Incident"
        description="Are you sure you want to approve this incident? A case will be created automatically."
        confirmLabel="Approve"
        onConfirm={handleApprove}
        isLoading={approveIncident.isPending}
      />

      {/* Reject dialog */}
      {rejectTarget && (
        <RejectionDialog
          open={!!rejectTarget}
          onOpenChange={(open) => !open && setRejectTarget(null)}
          incidentId={rejectTarget}
        />
      )}
    </>
  );
}
