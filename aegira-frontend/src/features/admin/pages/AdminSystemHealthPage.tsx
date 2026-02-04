import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/common/PageLoader';
import { EmptyState } from '@/components/common/EmptyState';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';

interface SystemHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: 'healthy' | 'warning' | 'error';
    api: 'healthy' | 'warning' | 'error';
    notifications: 'healthy' | 'warning' | 'error';
    scheduler: 'healthy' | 'warning' | 'error';
  };
  metrics: {
    uptime: string;
    avgResponseTime: string;
    activeUsers: number;
    checkInsToday: number;
    totalWorkers: number;
    totalTeams: number;
  };
  recentEvents: Array<{
    type: 'success' | 'warning' | 'error';
    message: string;
    timestamp: string;
  }>;
}

export function AdminSystemHealthPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'system-health'],
    staleTime: STALE_TIMES.REALTIME, // Real-time monitoring data
    queryFn: () => apiClient.get<SystemHealthResponse>(ENDPOINTS.ADMIN.SYSTEM_HEALTH),
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="success">Healthy</Badge>;
      case 'warning':
        return <Badge variant="warning">Warning</Badge>;
      case 'error':
      case 'degraded':
      case 'unhealthy':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500 mt-0.5" />;
      default:
        return null;
    }
  };

  const services = data?.services || {
    database: 'healthy',
    api: 'healthy',
    notifications: 'healthy',
    scheduler: 'healthy',
  };
  const metrics = data?.metrics || {
    uptime: '0%',
    avgResponseTime: '0ms',
    activeUsers: 0,
    checkInsToday: 0,
    totalWorkers: 0,
    totalTeams: 0,
  };
  const recentEvents = data?.recentEvents || [];

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="dashboard">
    <div className="space-y-6">
      <PageHeader
        title="System Health"
        description="Monitor system status and performance"
        action={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">{metrics.uptime}</div>
            <p className="text-sm text-muted-foreground">Uptime (30 days)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{metrics.avgResponseTime}</div>
            <p className="text-sm text-muted-foreground">Avg Response Time</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{metrics.activeUsers}</div>
            <p className="text-sm text-muted-foreground">Active Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{metrics.checkInsToday}</div>
            <p className="text-sm text-muted-foreground">Check-ins Today</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{metrics.totalWorkers}</div>
            <p className="text-sm text-muted-foreground">Total Workers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{metrics.totalTeams}</div>
            <p className="text-sm text-muted-foreground">Total Teams</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(services).map(([service, status]) => (
                <div key={service} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status)}
                    <span className="capitalize">{service.replace(/_/g, ' ')}</span>
                  </div>
                  {getStatusBadge(status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Events</CardTitle>
          </CardHeader>
          <CardContent>
            {recentEvents.length === 0 ? (
              <EmptyState
                title="No recent events"
                description="System events will appear here."
                icon={<Activity className="h-10 w-10" />}
              />
            ) : (
              <div className="space-y-4">
                {recentEvents.map((event) => (
                  <div key={`${event.timestamp}-${event.message}`} className="flex items-start gap-2 text-sm">
                    {getEventIcon(event.type)}
                    <div>
                      <p>{event.message}</p>
                      <p className="text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </PageLoader>
  );
}
