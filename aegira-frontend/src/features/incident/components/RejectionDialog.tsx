import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useRejectIncident } from '../hooks/useRejectIncident';
import { useToast } from '@/lib/hooks/use-toast';

const REJECTION_REASON_OPTIONS = [
  { value: 'DUPLICATE_REPORT', label: 'Duplicate Report' },
  { value: 'INSUFFICIENT_INFORMATION', label: 'Insufficient Information' },
  { value: 'NOT_WORKPLACE_INCIDENT', label: 'Not a Workplace Incident' },
  { value: 'OTHER', label: 'Other' },
] as const;

const rejectIncidentSchema = z.object({
  rejectionReason: z.enum(
    ['DUPLICATE_REPORT', 'INSUFFICIENT_INFORMATION', 'NOT_WORKPLACE_INCIDENT', 'OTHER'],
    { required_error: 'Please select a reason' }
  ),
  rejectionExplanation: z
    .string()
    .min(1, 'Explanation is required')
    .max(500),
});

type RejectIncidentFormData = z.infer<typeof rejectIncidentSchema>;

interface RejectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incidentId: string;
}

export function RejectionDialog({
  open,
  onOpenChange,
  incidentId,
}: RejectionDialogProps) {
  const rejectIncident = useRejectIncident();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<RejectIncidentFormData>({
    resolver: zodResolver(rejectIncidentSchema),
    defaultValues: {
      rejectionReason: undefined,
      rejectionExplanation: '',
    },
  });

  const selectedReason = watch('rejectionReason');

  const onSubmit = async (data: RejectIncidentFormData) => {
    try {
      await rejectIncident.mutateAsync({ incidentId, data });
      toast({
        variant: 'success',
        title: 'Incident rejected',
        description: 'The incident has been rejected and the reporter has been notified.',
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to reject',
        description: err instanceof Error ? err.message : 'Something went wrong.',
      });
    }
  };

  const handleClose = (value: boolean) => {
    if (!value) reset();
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Incident</DialogTitle>
          <DialogDescription>
            Provide a reason for rejecting this incident report. The reporter will
            be notified.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Rejection Reason</Label>
            <Select
              value={selectedReason || ''}
              onValueChange={(value) =>
                setValue(
                  'rejectionReason',
                  value as RejectIncidentFormData['rejectionReason']
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REJECTION_REASON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.rejectionReason && (
              <p className="text-sm text-destructive">
                {errors.rejectionReason.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rejectionExplanation">Explanation</Label>
            <Textarea
              id="rejectionExplanation"
              placeholder="Provide a detailed explanation for the rejection..."
              rows={4}
              {...register('rejectionExplanation')}
            />
            {errors.rejectionExplanation && (
              <p className="text-sm text-destructive">
                {errors.rejectionExplanation.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={rejectIncident.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={rejectIncident.isPending}
            >
              {rejectIncident.isPending ? 'Rejecting...' : 'Reject Incident'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
