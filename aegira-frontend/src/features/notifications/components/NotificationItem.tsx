import {
  Bell,
  ClipboardCheck,
  Users,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Archive,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { getRelativeTime } from '@/lib/utils/date.utils';
import type { Notification, NotificationType } from '@/types/common.types';

interface NotificationItemProps {
  notification: Notification;
  onClick?: () => void;
  onArchive?: (id: string) => void;
  compact?: boolean;
}

const typeConfig: Record<
  NotificationType,
  {
    icon: typeof Bell;
    label: string;
    bgColor: string;
    iconColor: string;
    accentColor: string;
  }
> = {
  CHECK_IN_REMINDER: {
    icon: ClipboardCheck,
    label: 'Reminder',
    bgColor: 'bg-blue-50 dark:bg-blue-950/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    accentColor: 'border-l-blue-500',
  },
  MISSED_CHECK_IN: {
    icon: AlertCircle,
    label: 'Missed',
    bgColor: 'bg-red-50 dark:bg-red-950/40',
    iconColor: 'text-red-600 dark:text-red-400',
    accentColor: 'border-l-red-500',
  },
  TEAM_ALERT: {
    icon: Users,
    label: 'Team',
    bgColor: 'bg-orange-50 dark:bg-orange-950/40',
    iconColor: 'text-orange-600 dark:text-orange-400',
    accentColor: 'border-l-orange-500',
  },
  SYSTEM: {
    icon: Info,
    label: 'System',
    bgColor: 'bg-slate-50 dark:bg-slate-900/40',
    iconColor: 'text-slate-600 dark:text-slate-400',
    accentColor: 'border-l-slate-400',
  },
  INCIDENT_SUBMITTED: {
    icon: AlertTriangle,
    label: 'Incident',
    bgColor: 'bg-amber-50 dark:bg-amber-950/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    accentColor: 'border-l-amber-500',
  },
  INCIDENT_APPROVED: {
    icon: CheckCircle2,
    label: 'Approved',
    bgColor: 'bg-green-50 dark:bg-green-950/40',
    iconColor: 'text-green-600 dark:text-green-400',
    accentColor: 'border-l-green-500',
  },
  INCIDENT_REJECTED: {
    icon: XCircle,
    label: 'Rejected',
    bgColor: 'bg-red-50 dark:bg-red-950/40',
    iconColor: 'text-red-600 dark:text-red-400',
    accentColor: 'border-l-red-500',
  },
};

export function NotificationItem({ notification, onClick, onArchive, compact }: NotificationItemProps) {
  const config = typeConfig[notification.type] ?? typeConfig.SYSTEM;
  const Icon = config.icon;
  const isUnread = !notification.read_at;

  return (
    <button
      type="button"
      className={cn(
        'group relative flex w-full items-start gap-3 border-l-[3px] text-left transition-all',
        compact ? 'px-3 py-2.5' : 'px-4 py-3.5',
        // Unread: accent border + tinted bg + stronger presence
        isUnread && [
          config.accentColor,
          'bg-muted/50 dark:bg-muted/30',
          'hover:bg-muted/70 dark:hover:bg-muted/50',
        ],
        // Read: transparent border + clean bg + subtle hover
        !isUnread && [
          'border-l-transparent',
          'bg-background',
          'hover:bg-muted/30 dark:hover:bg-muted/20',
        ]
      )}
      onClick={onClick}
    >
      {/* Icon avatar */}
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg transition-colors',
          compact ? 'h-8 w-8' : 'h-9 w-9',
          config.bgColor
        )}
      >
        <Icon className={cn('h-4 w-4', config.iconColor)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {/* Title row: title + type label */}
            <div className="flex items-center gap-2">
              <p
                className={cn(
                  'truncate text-sm leading-snug',
                  isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'
                )}
              >
                {notification.title}
              </p>
              {!compact && (
                <span
                  className={cn(
                    'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none',
                    config.bgColor,
                    config.iconColor
                  )}
                >
                  {config.label}
                </span>
              )}
            </div>

            {/* Message */}
            <p
              className={cn(
                'mt-0.5 text-xs leading-relaxed text-muted-foreground',
                compact ? 'line-clamp-1' : 'line-clamp-2'
              )}
            >
              {notification.message}
            </p>
          </div>

          {/* Right side: archive button (on hover) + unread dot */}
          <div className="flex shrink-0 items-center gap-1.5">
            {onArchive && (
              <span
                role="button"
                tabIndex={0}
                className="rounded-md p-1 text-muted-foreground/50 opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive(notification.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    e.preventDefault();
                    onArchive(notification.id);
                  }
                }}
                title="Archive"
              >
                <Archive className="h-3.5 w-3.5" />
              </span>
            )}
            {isUnread && (
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
            )}
          </div>
        </div>

        {/* Timestamp */}
        <p className={cn('mt-1 text-[11px] text-muted-foreground/60', compact && 'mt-0.5')}>
          {getRelativeTime(notification.created_at)}
        </p>
      </div>
    </button>
  );
}
