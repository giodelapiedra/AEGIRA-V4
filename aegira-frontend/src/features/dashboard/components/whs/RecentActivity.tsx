import { useNavigate } from 'react-router-dom';
import { Activity, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { EmptyState } from '@/components/common/EmptyState';
import { cn } from '@/lib/utils/cn';
import { getRelativeTime } from '@/lib/utils/date.utils';
import type { ActivityEvent } from '@/types/whs-dashboard.types';

interface RecentActivityProps {
  events: ActivityEvent[];
}

const getEventInitials = (eventType: string): string => {
  const parts = eventType
    .split('_')
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return 'AC';
  return parts.map((part) => part[0]).join('').toUpperCase();
};

export function RecentActivity({ events }: RecentActivityProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            Recent Activity
          </CardTitle>
          <Badge variant="outline" className="font-medium tabular-nums">
            {events.length} event{events.length === 1 ? '' : 's'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {events.length === 0 ? (
          <EmptyState
            icon={<Activity className="h-12 w-12" />}
            title="No recent activity"
            description="Incident and case events will appear here"
            className="py-8"
          />
        ) : (
          <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
            {events.map((event) => {
              const isClickable = !!event.actionUrl;

              return (
                <button
                  key={event.id}
                  type="button"
                  disabled={!isClickable}
                  className={cn(
                    'group relative flex w-full items-start gap-3 rounded-lg border border-transparent p-3 text-left transition-all',
                    isClickable && 'cursor-pointer hover:border-border/70 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    !isClickable && 'cursor-default'
                  )}
                  onClick={() => isClickable && event.actionUrl && navigate(event.actionUrl)}
                >
                  <Avatar className="mt-0.5 h-8 w-8 border bg-background">
                    <AvatarFallback className="text-[10px] font-semibold text-muted-foreground">
                      {getEventInitials(event.type)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm leading-snug">{event.message}</p>
                      {isClickable && (
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {getRelativeTime(event.timestamp)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
