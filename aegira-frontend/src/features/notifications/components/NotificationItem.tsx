import { Bell, ClipboardCheck, Users, AlertCircle, AlertTriangle, CheckCircle2, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { getRelativeTime } from '@/lib/utils/date.utils';
import type { Notification, NotificationType } from '@/types/common.types';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface NotificationItemProps {
  notification: Notification;
  onClick?: () => void;
}

const iconConfig: Record<NotificationType, { icon: typeof Bell; bgColor: string; iconColor: string }> = {
  CHECK_IN_REMINDER: {
    icon: ClipboardCheck,
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  MISSED_CHECK_IN: {
    icon: AlertCircle,
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
  },
  TEAM_ALERT: {
    icon: Users,
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    iconColor: 'text-orange-600 dark:text-orange-400',
  },
  SYSTEM: {
    icon: Info,
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    iconColor: 'text-gray-600 dark:text-gray-400',
  },
  INCIDENT_SUBMITTED: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  INCIDENT_APPROVED: {
    icon: CheckCircle2,
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-400',
  },
  INCIDENT_REJECTED: {
    icon: XCircle,
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
  },
};

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const config = iconConfig[notification.type] ?? iconConfig.SYSTEM;
  const Icon = config.icon;
  const isUnread = !notification.read_at;

  return (
    <Alert 
      className={cn(
        'flex items-center justify-between p-3 border-0 transition-colors cursor-pointer',
        isUnread ? 'bg-muted/40 hover:bg-muted/60' : 'hover:bg-muted/20 bg-background'
      )}
      onClick={onClick}
    >
      <Avatar className="h-9 w-9 rounded-sm mr-3">
        <AvatarFallback className={cn('rounded-sm', config.bgColor)}>
          <Icon className={cn('h-4 w-4', config.iconColor)} />
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 flex-col justify-center gap-0.5 min-w-0">
        <AlertTitle className={cn("text-sm mb-0", isUnread ? "font-semibold" : "font-medium")}>
          {notification.title}
        </AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground line-clamp-2">
          {notification.message}
        </AlertDescription>
        <span className="text-[10px] text-muted-foreground/70">
          {getRelativeTime(notification.created_at)}
        </span>
      </div>
      
      {isUnread && (
        <AlertCircle className="h-3 w-3 text-red-600 dark:text-red-400 ml-2 flex-shrink-0" />
      )}
    </Alert>
  );
}
