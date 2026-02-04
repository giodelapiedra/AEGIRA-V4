import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useSubmitCheckIn } from '../hooks/useSubmitCheckIn';

const checkInSchema = z.object({
  sleepHours: z.number().min(0, 'Must be 0 or more').max(24, 'Must be 24 or less'),
  sleepQuality: z.number().int().min(1, 'Min 1').max(10, 'Max 10'),
  fatigueLevel: z.number().int().min(1, 'Min 1').max(10, 'Max 10'),
  stressLevel: z.number().int().min(1, 'Min 1').max(10, 'Max 10'),
  painLevel: z.number().int().min(0, 'Min 0').max(10, 'Max 10'),
  painLocation: z.string().optional(),
  notes: z.string().optional(),
});

type CheckInFormData = z.infer<typeof checkInSchema>;

interface CheckInFormProps {
  onSuccess?: () => void;
}

export function CheckInForm({ onSuccess }: CheckInFormProps) {
  const submitMutation = useSubmitCheckIn();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CheckInFormData>({
    resolver: zodResolver(checkInSchema),
    defaultValues: {
      sleepHours: 7,
      sleepQuality: 5,
      fatigueLevel: 5,
      stressLevel: 5,
      painLevel: 0,
    },
  });

  const painLevel = watch('painLevel');

  const onSubmit = async (data: CheckInFormData) => {
    try {
      await submitMutation.mutateAsync(data);
      onSuccess?.();
    } catch {
      // Error is available via submitMutation.error
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Check-In</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Sleep Hours</Label>
              <Input
                type="number"
                step="0.5"
                {...register('sleepHours', { valueAsNumber: true })}
              />
              {errors.sleepHours && (
                <p className="text-sm text-red-500 mt-1">{errors.sleepHours.message}</p>
              )}
            </div>

            <div>
              <Label>Sleep Quality (1-10)</Label>
              <Input
                type="number"
                {...register('sleepQuality', { valueAsNumber: true })}
              />
              {errors.sleepQuality && (
                <p className="text-sm text-red-500 mt-1">{errors.sleepQuality.message}</p>
              )}
            </div>

            <div>
              <Label>Fatigue Level (1-10)</Label>
              <Input
                type="number"
                {...register('fatigueLevel', { valueAsNumber: true })}
              />
              {errors.fatigueLevel && (
                <p className="text-sm text-red-500 mt-1">{errors.fatigueLevel.message}</p>
              )}
            </div>

            <div>
              <Label>Stress Level (1-10)</Label>
              <Input
                type="number"
                {...register('stressLevel', { valueAsNumber: true })}
              />
              {errors.stressLevel && (
                <p className="text-sm text-red-500 mt-1">{errors.stressLevel.message}</p>
              )}
            </div>

            <div>
              <Label>Pain Level (0-10)</Label>
              <Input
                type="number"
                {...register('painLevel', { valueAsNumber: true })}
              />
              {errors.painLevel && (
                <p className="text-sm text-red-500 mt-1">{errors.painLevel.message}</p>
              )}
            </div>

            {painLevel > 0 && (
              <div>
                <Label>Pain Location</Label>
                <Input
                  type="text"
                  {...register('painLocation')}
                  placeholder="e.g., Lower back, Knee"
                />
              </div>
            )}
          </div>

          <div>
            <Label>Notes (Optional)</Label>
            <Input
              type="text"
              {...register('notes')}
              placeholder="Any additional notes..."
            />
          </div>

          {submitMutation.error && (
            <p className="text-sm text-red-500">{submitMutation.error.message}</p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting || submitMutation.isPending}>
            {submitMutation.isPending ? 'Submitting...' : 'Submit Check-In'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
