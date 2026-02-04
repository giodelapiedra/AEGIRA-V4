import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';

interface SliderFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  showValue?: boolean;
  lowLabel?: string;
  highLabel?: string;
  colorScale?: boolean;
  error?: string;
}

export function SliderField({
  label,
  value,
  onChange,
  min = 1,
  max = 10,
  step = 1,
  description,
  showValue = true,
  lowLabel,
  highLabel,
  colorScale = false,
  error,
}: SliderFieldProps) {
  const getColorClass = (val: number) => {
    if (!colorScale) return 'text-primary';
    const percentage = ((val - min) / (max - min)) * 100;
    if (percentage <= 30) return 'text-green-600';
    if (percentage <= 60) return 'text-yellow-600';
    if (percentage <= 80) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {showValue && (
          <span className={cn('text-lg font-bold', getColorClass(value))}>
            {value}
          </span>
        )}
      </div>

      <Slider
        value={[value]}
        onValueChange={(vals) => onChange(vals[0])}
        min={min}
        max={max}
        step={step}
        className="py-2"
      />

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{lowLabel || min}</span>
        <span>{highLabel || max}</span>
      </div>

      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
