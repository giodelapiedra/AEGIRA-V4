import { useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/common/EmptyState';
import { cn } from '@/lib/utils/cn';
import { getRelativeTime } from '@/lib/utils/date.utils';
import type { ActivityEvent } from '@/types/whs-dashboard.types';

interface RecentActivityProps {
  events: ActivityEvent[];
}

const EVENT_DOT_COLORS: Record<string, string> = {
  INCIDENT_CREATED: 'bg-yellow-500',
  INCIDENT_APPROVED: 'bg-green-500',
  INCIDENT_REJECTED: 'bg-red-500',
  CASE_CREATED: 'bg-blue-500',
  CASE_UPDATED: 'bg-purple-500',
  CASE_RESOLVED: 'bg-green-500',
};

export function RecentActivity({ events }: RecentActivityProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <EmptyState
            icon={<Activity className="h-12 w-12" />}
            title="No recent activity"
            description="Incident and case events will appear here"
            className="py-8"
          />
        ) : (
          <div className="max-h-[400px] space-y-1 overflow-y-auto pr-1">
            {events.map((event) => {
              const dotColor = EVENT_DOT_COLORS[event.type] || 'bg-slate-400';
              const isClickable = !!event.actionUrl;

              return (
                <button
                  key={event.id}
                  type="button"
                  disabled={!isClickable}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-lg p-2.5 text-left transition-colors',
                    isClickable && 'hover:bg-muted/50 cursor-pointer',
                    !isClickable && 'cursor-default'
                  )}
                  onClick={() => isClickable && event.actionUrl && navigate(event.actionUrl)}
                >
                  <div className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', dotColor)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">{event.message}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
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
