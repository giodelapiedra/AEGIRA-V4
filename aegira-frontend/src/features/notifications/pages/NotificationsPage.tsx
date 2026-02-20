import { useState, useCallback, useRef, useMemo } from 'react';
import { DateTime } from 'luxon';
import {
  Bell,
  CheckCheck,
  Circle,
  CheckCircle2,
  Inbox,
  Loader2,
  BellOff,
} from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/common/PageLoader';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { NotificationItem } from '../components/NotificationItem';
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  type Notification,
} from '../hooks/useNotifications';

type NotificationTab = 'all' | 'unread' | 'read';

/** Group notifications by date bucket: Today, Yesterday, This Week, Earlier */
function groupByDate(notifications: Notification[]): { label: string; items: Notification[] }[] {
  const now = DateTime.now();
  const todayStart = now.startOf('day');
  const yesterdayStart = todayStart.minus({ days: 1 });
  const weekStart = todayStart.minus({ days: 6 });

  const groups: Record<string, Notification[]> = {};
  const order: string[] = [];

  for (const n of notifications) {
    const dt = DateTime.fromISO(n.created_at);
    let label: string;

    if (dt >= todayStart) {
      label = 'Today';
    } else if (dt >= yesterdayStart) {
      label = 'Yesterday';
    } else if (dt >= weekStart) {
      label = 'This Week';
    } else {
      label = 'Earlier';
    }

    if (!groups[label]) {
      groups[label] = [];
      order.push(label);
    }
    groups[label].push(n);
  }

  return order.map((label) => ({ label, items: groups[label] }));
}

export function NotificationsPage() {
  const [tab, setTab] = useState<NotificationTab>('all');
  const [page, setPage] = useState(1);
  const limit = 20;
  const { toast } = useToast();

  // Accumulate items across pages for load-more behavior
  const accumulatedRef = useRef<Map<string, Notification[][]>>(new Map());

  const { data, isLoading, error, isFetching, isPlaceholderData } = useNotifications({
    page,
    limit,
    filter: tab,
  });
  const { data: unreadData } = useUnreadCount();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  // Build accumulated list: store items per page, flatten for display
  // Skip writing when data is stale placeholder from a previous tab (prevents cross-tab leakage)
  const cacheKey = tab;
  if (data?.items && data.items.length > 0 && !isPlaceholderData) {
    if (!accumulatedRef.current.has(cacheKey)) {
      accumulatedRef.current.set(cacheKey, []);
    }
    const pages = accumulatedRef.current.get(cacheKey)!;
    pages[page - 1] = data.items;
  }

  const accumulatedPages = accumulatedRef.current.get(cacheKey) ?? [];
  const notifications: Notification[] = accumulatedPages.flat();
  const total = data?.pagination?.total ?? 0;
  const hasMore = page * limit < total;
  const unreadCount = unreadData?.count ?? 0;

  const grouped = useMemo(() => groupByDate(notifications), [notifications]);

  const handleTabChange = (value: string) => {
    setTab(value as NotificationTab);
    setPage(1);
    accumulatedRef.current.delete(value);
  };

  // Optimistically update a notification's read_at in the accumulated ref
  const optimisticMarkRead = useCallback((notificationId: string) => {
    const pages = accumulatedRef.current.get(cacheKey);
    if (!pages) return;
    const now = new Date().toISOString();
    for (const page of pages) {
      if (!page) continue;
      const item = page.find((n) => n.id === notificationId);
      if (item && !item.read_at) {
        item.read_at = now;
        break;
      }
    }
  }, [cacheKey]);

  const handleNotificationClick = useCallback(
    async (notificationId: string, isRead: boolean) => {
      if (!isRead) {
        optimisticMarkRead(notificationId);
        try {
          await markAsRead.mutateAsync(notificationId);
        } catch (err) {
          toast({
            title: 'Error',
            description: err instanceof Error ? err.message : 'Failed to mark as read',
            variant: 'destructive',
          });
        }
      }
    },
    [markAsRead, toast, optimisticMarkRead]
  );

  const handleLoadMore = () => {
    setPage((p) => p + 1);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead.mutateAsync();
      // Clear accumulated ref so refetch populates fresh read-state across all pages
      accumulatedRef.current.clear();
      toast({ title: 'All notifications marked as read' });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to mark all as read',
        variant: 'destructive',
      });
    }
  };

  // Empty state config per tab
  const emptyStates: Record<
    NotificationTab,
    { icon: React.ReactNode; title: string; description: string }
  > = {
    all: {
      icon: <Inbox className="h-12 w-12" />,
      title: 'No notifications yet',
      description: 'When you receive notifications, they will appear here.',
    },
    unread: {
      icon: <CheckCheck className="h-12 w-12" />,
      title: 'All caught up!',
      description: "You've read all your notifications. Nice work.",
    },
    read: {
      icon: <BellOff className="h-12 w-12" />,
      title: 'No read notifications',
      description: "Notifications you've read will appear here.",
    },
  };

  const empty = emptyStates[tab];
  const remaining = Math.max(0, total - page * limit);

  return (
    <PageLoader isLoading={isLoading && page === 1} error={error} skeleton="cards">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <PageHeader
          title="Notifications"
          description={
            total > 0
              ? `${total} notification${total !== 1 ? 's' : ''}${unreadCount > 0 ? ` \u00b7 ${unreadCount} unread` : ''}`
              : undefined
          }
          action={
            unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllRead}
                disabled={markAllAsRead.isPending}
                className="gap-1.5"
              >
                {markAllAsRead.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5" />
                )}
                Mark all read
              </Button>
            )
          }
        />

        {/* Filter Tabs */}
        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="all" className="gap-1.5">
              <Bell className="h-3.5 w-3.5" />
              All
              {total > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 px-1.5 text-[10px]">
                  {total > 99 ? '99+' : total}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="unread" className="gap-1.5">
              <Circle className="h-3.5 w-3.5" />
              Unread
              {unreadCount > 0 && (
                <Badge variant="default" className="ml-0.5 h-5 min-w-5 px-1.5 text-[10px]">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="read" className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Read
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Content */}
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          {isLoading && page === 1 ? (
            <NotificationSkeleton />
          ) : notifications.length === 0 ? (
            <EmptyState
              title={empty.title}
              description={empty.description}
              icon={empty.icon}
              className="py-16"
            />
          ) : (
            <div>
              {grouped.map((group) => (
                <div key={group.label}>
                  {/* Date group header */}
                  <div className="sticky top-0 z-10 border-b bg-muted/40 px-4 py-2 backdrop-blur-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </span>
                  </div>

                  {/* Notifications in group */}
                  <div className="divide-y divide-border/50">
                    {group.items.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onClick={() =>
                          handleNotificationClick(notification.id, !!notification.read_at)
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Load more */}
          {hasMore && (
            <div className="border-t bg-muted/20 p-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground hover:text-foreground"
                onClick={handleLoadMore}
                disabled={isFetching}
              >
                {isFetching ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>Load more ({remaining} remaining)</>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </PageLoader>
  );
}

/** Skeleton loader matching the new card layout */
function NotificationSkeleton() {
  return (
    <div>
      {/* Fake date header */}
      <div className="border-b bg-muted/40 px-4 py-2">
        <div className="h-3 w-12 animate-pulse rounded bg-muted" />
      </div>
      <div className="divide-y divide-border/50">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3.5">
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
                <div className="h-4 w-12 animate-pulse rounded-md bg-muted" />
              </div>
              <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
              <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
