import { cn } from '@/lib/utils/cn';
import type { ReadinessResult, ReadinessCategory } from '@/types/check-in.types';

interface ReadinessIndicatorProps {
  result: ReadinessResult;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const categoryConfig: Record<ReadinessCategory, {
  color: string;
  label: string;
  description: string;
}> = {
  ready: {
    color: 'text-green-600',
    label: 'Fit to Work',
    description: 'Fully ready for work',
  },
  modified_duty: {
    color: 'text-yellow-600',
    label: 'Light Duty',
    description: 'Can work with modifications',
  },
  needs_attention: {
    color: 'text-orange-600',
    label: 'Take Care',
    description: 'Requires attention',
  },
  not_ready: {
    color: 'text-red-600',
    label: 'Rest Needed',
    description: 'Not ready for full duty',
  },
};

const sizeConfig = {
  sm: {
    container: 'w-20 h-20',
    score: 'text-[10px]',
    label: 'text-xs',
  },
  md: {
    container: 'w-28 h-28',
    score: 'text-xs',
    label: 'text-sm',
  },
  lg: {
    container: 'w-36 h-36',
    score: 'text-sm',
    label: 'text-base',
  },
};

export function ReadinessIndicator({
  result,
  size = 'md',
  showLabel = true,
}: ReadinessIndicatorProps) {
  const config = categoryConfig[result.category];
  const sizes = sizeConfig[size];

  // Calculate the stroke dasharray for the circular progress
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (result.score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Circular Progress */}
      <div className={cn('relative', sizes.container)}>
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            className={config.color}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset,
              transition: 'stroke-dashoffset 0.5s ease-in-out',
            }}
          />
        </svg>
        {/* Status in center */}
        <div className="absolute inset-0 flex items-center justify-center px-2">
          <span className={cn('font-bold text-center leading-tight', sizes.score, config.color)}>
            {config.label}
          </span>
        </div>
      </div>

      {/* Description */}
      {showLabel && (
        <div className="text-center">
          <span
            className={cn(
              'text-muted-foreground',
              sizes.label
            )}
          >
            {config.description}
          </span>
        </div>
      )}
    </div>
  );
}
