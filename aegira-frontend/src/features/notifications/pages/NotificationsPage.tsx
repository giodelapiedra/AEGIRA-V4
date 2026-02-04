import { useState } from 'react';
import {
  Bell,
  CheckCheck,
  Circle,
  CheckCircle2,
  Inbox,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageLoader } from '@/components/common/PageLoader';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { NotificationItem } from '../components/NotificationItem';
import { useNotifications, useUnreadCount, useMarkAsRead, useMarkAllAsRead } from '../hooks/useNotifications';

type NotificationTab = 'all' | 'unread' | 'read';

export function NotificationsPage() {
  const [tab, setTab] = useState<NotificationTab>('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, error, isFetching } = useNotifications({
    page,
    pageSize,
    filter: tab,
  });
  const { data: unreadData } = useUnreadCount();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const notifications = data?.items || [];
  const total = data?.pagination?.total ?? 0;
  const hasMore = page * pageSize < total;
  const unreadCount = unreadData?.count ?? 0;

  const handleTabChange = (value: string) => {
    setTab(value as NotificationTab);
    setPage(1);
  };

  const handleNotificationClick = (notificationId: string, isRead: boolean) => {
    if (!isRead) {
      markAsRead.mutate(notificationId);
    }
  };

  const handleLoadMore = () => {
    setPage((p) => p + 1);
  };

  // Empty state config per tab
  const emptyStates: Record<NotificationTab, { icon: React.ReactNode; title: string; description: string }> = {
    all: {
      icon: <Inbox className="h-10 w-10" />,
      title: 'No notifications yet',
      description: 'When you receive notifications, they will appear here.',
    },
    unread: {
      icon: <CheckCheck className="h-10 w-10" />,
      title: 'All caught up!',
      description: "You've read all your notifications.",
    },
    read: {
      icon: <CheckCircle2 className="h-10 w-10" />,
      title: 'No read notifications',
      description: "Notifications you've read will appear here.",
    },
  };

  const empty = emptyStates[tab];

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="cards">
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHeader
          title="Notifications"
          description={total > 0 ? `${total} notification${total !== 1 ? 's' : ''}` : undefined}
          action={
            unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllAsRead.mutate()}
                disabled={markAllAsRead.isPending}
                className="text-primary"
              >
                <CheckCheck className="mr-1.5 h-4 w-4" />
                Mark all read
              </Button>
            )
          }
        />

        {/* Tabs */}
        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="all" className="gap-1.5">
              <Bell className="h-4 w-4" />
              All
            </TabsTrigger>
            <TabsTrigger value="unread" className="gap-1.5">
              <Circle className="h-4 w-4" />
              Unread
              {unreadCount > 0 && (
                <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="read" className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Read
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Content */}
        <div className="rounded-lg border bg-card overflow-hidden">
          {isLoading && page === 1 ? (
            // Loading skeleton
            <div className="divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 p-4">
                  <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-1/4 rounded bg-muted animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState
              title={empty.title}
              description={empty.description}
              icon={empty.icon}
            />
          ) : (
            // Notification list
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() =>
                    handleNotificationClick(notification.id, !!notification.read_at)
                  }
                />
              ))}
            </div>
          )}

          {/* Load more */}
          {hasMore && (
            <div className="p-4 border-t bg-muted/30">
              <Button
                variant="ghost"
                className="w-full"
                onClick={handleLoadMore}
                disabled={isFetching}
              >
                {isFetching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  `Load more (${total - page * pageSize} remaining)`
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </PageLoader>
  );
}
