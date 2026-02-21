import { cn } from '@/lib/utils/cn';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'sticky';
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  variant = 'default',
}: EmptyStateProps) {
  if (variant === 'sticky') {
    return (
      <div className={cn('flex items-center justify-center px-6 py-16', className)}>
        {/* Dotted background wrapper */}
        <div
          className="relative w-full max-w-md"
          style={{
            backgroundImage: 'radial-gradient(circle, hsl(var(--border) / 0.4) 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        >
          {/* Sticky note card */}
          <div className="relative mx-auto -rotate-1 rounded-2xl border border-border/50 bg-primary/[0.03] px-8 pb-10 pt-14 shadow-sm">
            {/* Folder tab */}
            <div className="absolute -top-px left-1/2 h-3.5 w-24 -translate-x-1/2 rounded-t-md border border-b-0 border-border/50 bg-card" />

            {/* Content */}
            <div className="flex flex-col items-center text-center">
              {icon && (
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary [&>svg]:h-8 [&>svg]:w-8">
                  {icon}
                </div>
              )}
              <h3 className="text-xl font-bold tracking-tight">{title}</h3>
              {description && (
                <p className="mt-2 max-w-[260px] text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              )}
              {action && <div className="mt-6">{action}</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-dashed border-border/80 bg-card/70 px-6 py-12 text-center',
        'flex flex-col items-center justify-center',
        className
      )}
    >
      {icon && <div className="mb-4 text-muted-foreground">{icon}</div>}
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
