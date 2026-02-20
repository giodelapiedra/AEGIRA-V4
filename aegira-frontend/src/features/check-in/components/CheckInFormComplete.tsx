import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useSubmitCheckIn } from '../hooks/useSubmitCheckIn';
import { useToast } from '@/lib/hooks/use-toast';
import { ROUTES } from '@/config/routes.config';
import { cn } from '@/lib/utils/cn';
import {
  Moon,
  Battery,
  Brain,
  Heart,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from 'lucide-react';

/**
 * Check-in form validation schema
 * Matches backend validator: check-in.validator.ts
 */
const checkInSchema = z.object({
  sleepHours: z
    .number()
    .min(0, 'Sleep hours must be 0 or more')
    .max(15, 'Sleep hours cannot exceed 15'),
  sleepQuality: z
    .number()
    .int()
    .min(1, 'Minimum is 1')
    .max(10, 'Maximum is 10'),
  energyLevel: z
    .number()
    .int()
    .min(1, 'Minimum is 1')
    .max(10, 'Maximum is 10'),
  stressLevel: z
    .number()
    .int()
    .min(1, 'Minimum is 1')
    .max(10, 'Maximum is 10'),
  painLevel: z
    .number()
    .int()
    .min(0, 'Minimum is 0')
    .max(10, 'Maximum is 10'),
  painLocation: z.string().optional(),
  physicalConditionNotes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
}).refine(
  (data) => {
    // If pain level > 0, pain location should be provided
    if (data.painLevel > 0 && !data.painLocation?.trim()) {
      return false;
    }
    return true;
  },
  {
    message: 'Please specify pain location when pain level is above 0',
    path: ['painLocation'],
  }
);

type CheckInFormData = z.infer<typeof checkInSchema>;

// Multi-step form steps
const STEPS = [
  { id: 'sleep', title: 'Sleep', icon: Moon },
  { id: 'energy', title: 'Energy', icon: Battery },
  { id: 'physical', title: 'Physical', icon: Heart },
  { id: 'notes', title: 'Notes', icon: Brain },
];

export function CheckInFormComplete() {
  const navigate = useNavigate();
  const submitMutation = useSubmitCheckIn();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CheckInFormData>({
    resolver: zodResolver(checkInSchema),
    defaultValues: {
      sleepHours: 7,
      sleepQuality: 5,
      energyLevel: 5,
      stressLevel: 5,
      painLevel: 0,
      painLocation: '',
      physicalConditionNotes: '',
      notes: '',
    },
  });

  const painLevel = watch('painLevel');
  const painLocation = watch('painLocation');

  const canProceedFromStep = (step: number): boolean => {
    if (step === 2 && painLevel > 0 && !painLocation?.trim()) {
      return false;
    }
    return true;
  };

  const onSubmit = async (data: CheckInFormData) => {
    if (currentStep !== STEPS.length - 1) return;
    try {
      const result = await submitMutation.mutateAsync(data);
      const score = result.readinessResult?.score;
      toast({
        title: 'Check-in Submitted!',
        description: score != null ? `Your readiness score: ${score}%` : 'Your check-in has been recorded.',
        variant: 'success',
      });
      navigate(ROUTES.DASHBOARD);
    } catch (error) {
      toast({
        title: 'Submission Failed',
        description: error instanceof Error ? error.message : 'Submission failed',
        variant: 'destructive',
      });
    }
  };

  const nextStep = () => {
    if (!canProceedFromStep(currentStep)) return;
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));
  const isLastStep = currentStep === STEPS.length - 1;

  const getSliderColor = useCallback((value: number, inverted = false) => {
    const normalizedValue = inverted ? 11 - value : value;
    if (normalizedValue <= 3) return 'text-red-500';
    if (normalizedValue <= 5) return 'text-orange-500';
    if (normalizedValue <= 7) return 'text-yellow-500';
    return 'text-green-500';
  }, []);

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
          e.preventDefault();
        }
      }}
    >
      {/* Progress Steps */}
      <div className="mb-6">
        <div className="flex justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  // Allow going back freely, but validate when going forward
                  if (index > currentStep && !canProceedFromStep(currentStep)) return;
                  setCurrentStep(index);
                }}
                className={cn(
                  'flex flex-col items-center gap-1 p-2 rounded-lg transition-colors',
                  isActive && 'bg-primary text-primary-foreground',
                  isCompleted && 'text-primary',
                  !isActive && !isCompleted && 'text-muted-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{step.title}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Content */}
      <Card>
        {/* Step 1: Sleep */}
        {currentStep === 0 && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Moon className="h-5 w-5" />
                Sleep Quality
              </CardTitle>
              <CardDescription>
                How well did you sleep last night?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Hours of Sleep</Label>
                <Controller
                  name="sleepHours"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center gap-4">
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        max="15"
                        className="w-24"
                        value={field.value}
                        onChange={(e) => {
                          const val = Math.min(15, Math.max(0, parseFloat(e.target.value) || 0));
                          field.onChange(val);
                        }}
                      />
                      <span className="text-muted-foreground">hours</span>
                      <span className={cn('text-lg font-bold',
                        field.value < 5 ? 'text-red-500' :
                        field.value < 7 ? 'text-yellow-500' : 'text-green-500'
                      )}>
                        {field.value < 5 ? 'Low' : field.value < 7 ? 'Moderate' : 'Good'}
                      </span>
                    </div>
                  )}
                />
                {errors.sleepHours && (
                  <p className="text-sm text-destructive">{errors.sleepHours.message}</p>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Sleep Quality</Label>
                  <Controller
                    name="sleepQuality"
                    control={control}
                    render={({ field }) => (
                      <span className={cn('text-lg font-bold', getSliderColor(field.value))}>
                        {field.value}/10
                      </span>
                    )}
                  />
                </div>
                <Controller
                  name="sleepQuality"
                  control={control}
                  render={({ field }) => (
                    <Slider
                      value={[field.value]}
                      onValueChange={(vals) => field.onChange(vals[0])}
                      min={1}
                      max={10}
                      step={1}
                    />
                  )}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Poor (restless)</span>
                  <span>Excellent (refreshed)</span>
                </div>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 2: Energy & Stress */}
        {currentStep === 1 && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Battery className="h-5 w-5" />
                Energy & Stress Levels
              </CardTitle>
              <CardDescription>
                Rate your current mental and physical state
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Energy Level</Label>
                  <Controller
                    name="energyLevel"
                    control={control}
                    render={({ field }) => (
                      <span className={cn('text-lg font-bold', getSliderColor(field.value))}>
                        {field.value}/10
                      </span>
                    )}
                  />
                </div>
                <Controller
                  name="energyLevel"
                  control={control}
                  render={({ field }) => (
                    <Slider
                      value={[field.value]}
                      onValueChange={(vals) => field.onChange(vals[0])}
                      min={1}
                      max={10}
                      step={1}
                    />
                  )}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Low Energy (1)</span>
                  <span>High Energy (10)</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Stress Level</Label>
                  <Controller
                    name="stressLevel"
                    control={control}
                    render={({ field }) => (
                      <span className={cn('text-lg font-bold', getSliderColor(field.value, true))}>
                        {field.value}/10
                      </span>
                    )}
                  />
                </div>
                <Controller
                  name="stressLevel"
                  control={control}
                  render={({ field }) => (
                    <Slider
                      value={[field.value]}
                      onValueChange={(vals) => field.onChange(vals[0])}
                      min={1}
                      max={10}
                      step={1}
                    />
                  )}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Calm (1)</span>
                  <span>Very Stressed (10)</span>
                </div>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 3: Physical Condition */}
        {currentStep === 2 && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Physical Condition
              </CardTitle>
              <CardDescription>
                Any pain or discomfort to report?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Pain Level</Label>
                  <Controller
                    name="painLevel"
                    control={control}
                    render={({ field }) => (
                      <span className={cn('text-lg font-bold',
                        field.value === 0 ? 'text-green-500' : getSliderColor(field.value, true)
                      )}>
                        {field.value === 0 ? 'None' : `${field.value}/10`}
                      </span>
                    )}
                  />
                </div>
                <Controller
                  name="painLevel"
                  control={control}
                  render={({ field }) => (
                    <Slider
                      value={[field.value]}
                      onValueChange={(vals) => field.onChange(vals[0])}
                      min={0}
                      max={10}
                      step={1}
                    />
                  )}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>No Pain (0)</span>
                  <span>Severe Pain (10)</span>
                </div>
              </div>

              {painLevel > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Pain Location *</Label>
                    <Controller
                      name="painLocation"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select pain location" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Head">Head</SelectItem>
                            <SelectItem value="Neck">Neck</SelectItem>
                            <SelectItem value="Shoulder (Left)">Shoulder (Left)</SelectItem>
                            <SelectItem value="Shoulder (Right)">Shoulder (Right)</SelectItem>
                            <SelectItem value="Upper Back">Upper Back</SelectItem>
                            <SelectItem value="Lower Back">Lower Back</SelectItem>
                            <SelectItem value="Chest">Chest</SelectItem>
                            <SelectItem value="Elbow (Left)">Elbow (Left)</SelectItem>
                            <SelectItem value="Elbow (Right)">Elbow (Right)</SelectItem>
                            <SelectItem value="Wrist/Hand (Left)">Wrist/Hand (Left)</SelectItem>
                            <SelectItem value="Wrist/Hand (Right)">Wrist/Hand (Right)</SelectItem>
                            <SelectItem value="Hip (Left)">Hip (Left)</SelectItem>
                            <SelectItem value="Hip (Right)">Hip (Right)</SelectItem>
                            <SelectItem value="Knee (Left)">Knee (Left)</SelectItem>
                            <SelectItem value="Knee (Right)">Knee (Right)</SelectItem>
                            <SelectItem value="Ankle/Foot (Left)">Ankle/Foot (Left)</SelectItem>
                            <SelectItem value="Ankle/Foot (Right)">Ankle/Foot (Right)</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.painLocation && (
                      <p className="text-sm text-destructive">{errors.painLocation.message}</p>
                    )}
                  </div>
                </>
              )}

              <Separator />

              <div className="space-y-2">
                <Label>Physical Condition Notes</Label>
                <Controller
                  name="physicalConditionNotes"
                  control={control}
                  render={({ field }) => (
                    <Input
                      placeholder="e.g., Slight headache, Muscle soreness"
                      {...field}
                    />
                  )}
                />
              </div>
            </CardContent>
          </>
        )}

        {/* Step 4: Additional Notes */}
        {currentStep === 3 && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Additional Notes
              </CardTitle>
              <CardDescription>
                Anything else you'd like to share? (Optional)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Share any additional context about how you're feeling today..."
                      rows={4}
                      {...field}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {field.value?.length || 0}/500 characters
                    </p>
                  </div>
                )}
              />
              {errors.notes && (
                <p className="text-sm text-destructive">{errors.notes.message}</p>
              )}
            </CardContent>
          </>
        )}

        {/* Error Display */}
        {submitMutation.error && (
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{submitMutation.error.message}</AlertDescription>
            </Alert>
          </CardContent>
        )}

        {/* Navigation */}
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={currentStep === 0 ? () => navigate(ROUTES.DASHBOARD) : prevStep}
            disabled={submitMutation.isPending}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {currentStep === 0 ? 'Cancel' : 'Back'}
          </Button>

          {isLastStep ? (
            <Button key="submit" type="submit" disabled={isSubmitting || submitMutation.isPending}>
              {submitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitMutation.isPending ? 'Submitting...' : 'Submit Check-In'}
            </Button>
          ) : (
            <Button key="next" type="button" onClick={nextStep} disabled={!canProceedFromStep(currentStep)}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </form>
  );
}
