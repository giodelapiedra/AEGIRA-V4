import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SliderField } from './SliderField';
import { useSubmitCheckIn } from '../hooks/useSubmitCheckIn';
import { useToast } from '@/lib/hooks/use-toast';
import { ROUTES } from '@/config/routes.config';
import { Moon, Battery, Brain, Heart, AlertCircle } from 'lucide-react';

export function CheckInFormImproved() {
  const navigate = useNavigate();
  const submitMutation = useSubmitCheckIn();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    sleepHours: 7,
    sleepQuality: 5,
    fatigueLevel: 5,
    stressLevel: 5,
    painLevel: 0,
    painLocation: '',
    notes: '',
  });

  const handleSliderChange = (field: string) => (value: number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await submitMutation.mutateAsync(formData);
      toast({
        title: 'Check-in Submitted',
        description: 'Your daily check-in has been recorded.',
        variant: 'success',
      });
      navigate(ROUTES.DASHBOARD);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Submission failed',
        variant: 'destructive',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-6">
        {/* Sleep Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Moon className="h-5 w-5" />
              Sleep
            </CardTitle>
            <CardDescription>How well did you sleep last night?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Hours of Sleep</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={formData.sleepHours}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      sleepHours: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-24"
                />
                <span className="text-muted-foreground">hours</span>
              </div>
            </div>

            <SliderField
              label="Sleep Quality"
              value={formData.sleepQuality}
              onChange={handleSliderChange('sleepQuality')}
              min={1}
              max={10}
              lowLabel="Poor"
              highLabel="Excellent"
            />
          </CardContent>
        </Card>

        {/* Energy & Stress Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Battery className="h-5 w-5" />
              Energy & Wellness
            </CardTitle>
            <CardDescription>Rate your current physical and mental state</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <SliderField
              label="Fatigue Level"
              value={formData.fatigueLevel}
              onChange={handleSliderChange('fatigueLevel')}
              min={1}
              max={10}
              lowLabel="Energized"
              highLabel="Exhausted"
              colorScale
              description="1 = Full of energy, 10 = Completely exhausted"
            />

            <SliderField
              label="Stress Level"
              value={formData.stressLevel}
              onChange={handleSliderChange('stressLevel')}
              min={1}
              max={10}
              lowLabel="Calm"
              highLabel="Very Stressed"
              colorScale
            />
          </CardContent>
        </Card>

        {/* Pain Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Physical Condition
            </CardTitle>
            <CardDescription>Any pain or discomfort?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <SliderField
              label="Pain Level"
              value={formData.painLevel}
              onChange={handleSliderChange('painLevel')}
              min={0}
              max={10}
              lowLabel="No Pain"
              highLabel="Severe Pain"
              colorScale
            />

            {formData.painLevel > 0 && (
              <div className="space-y-2">
                <Label>Pain Location</Label>
                <Input
                  placeholder="e.g., Lower back, Knee, Shoulder"
                  value={formData.painLocation}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      painLocation: e.target.value,
                    }))
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Additional Notes
            </CardTitle>
            <CardDescription>Anything else you'd like to share?</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Optional: Add any notes about how you're feeling today..."
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        {submitMutation.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{submitMutation.error.message}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => navigate(ROUTES.DASHBOARD)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit Check-In'}
          </Button>
        </div>
      </div>
    </form>
  );
}
