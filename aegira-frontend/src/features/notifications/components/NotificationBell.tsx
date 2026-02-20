import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationItem } from './NotificationItem';
import {
  useNotificationPreview,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
} from '../hooks/useNotifications';
import { useToast } from '@/lib/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { ROUTES } from '@/config/routes.config';

export function NotificationBell() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { data: preview } = useNotificationPreview();
  const { data: unreadData } = useUnreadCount();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const notifications = preview?.items || [];
  const unreadCount = unreadData?.count ?? 0;

  const handleNotificationClick = (notificationId: string, readAt: string | null) => {
    if (!readAt) {
      markAsRead.mutate(notificationId);
    }
  };

  const handleViewAll = () => {
    setOpen(false);
    navigate(ROUTES.NOTIFICATIONS);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[380px] p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">Notifications</h4>
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              disabled={markAllAsRead.isPending}
              onClick={() =>
                markAllAsRead.mutate(undefined, {
                  onError: (err) => {
                    toast({
                      title: 'Error',
                      description:
                        err instanceof Error ? err.message : 'Failed to mark all as read',
                      variant: 'destructive',
                    });
                  },
                })
              }
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>

        <Separator />

        {/* Notification list */}
        <div className="max-h-[340px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Bell className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">No notifications</p>
              <p className="mt-0.5 text-xs text-muted-foreground/60">
                You&apos;re all caught up
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  compact
                  onClick={() =>
                    handleNotificationClick(notification.id, notification.read_at)
                  }
                />
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Footer */}
        <div className="p-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleViewAll}
          >
            View all notifications
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
