import { Link } from 'react-router-dom';
import { ClipboardCheck, ArrowRight, Sparkles, Coffee, Clock, Calendar, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/common/PageLoader';
import { PageHeader } from '@/components/common/PageHeader';
import { ReadinessIndicator } from '@/features/check-in/components/ReadinessIndicator';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useAuth } from '@/lib/hooks/use-auth';
import { ROUTES } from '@/config/routes.config';
import { formatTime12h } from '@/lib/utils/format.utils';
import { cn } from '@/lib/utils/cn';
import type { WorkerSchedule } from '@/types/check-in.types';

// Determine what to show when worker hasn't checked in today
// Priority: holiday > day off > assigned today (window closed) > before window > window closed > window open
function getNotCheckedInState(schedule: WorkerSchedule) {
  if (schedule.isHoliday) {
    return {
      icon: <Calendar className="h-10 w-10 text-emerald-500" />,
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      borderColor: 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20',
      title: schedule.holidayName || 'Holiday',
      message: 'Today is a company holiday. No check-in required. Enjoy your day!',
      showButton: false,
    };
  }

  if (!schedule.isWorkDay) {
    return {
      icon: <Coffee className="h-10 w-10 text-indigo-500" />,
      iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
      borderColor: 'border-indigo-200 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/20',
      title: 'Day off',
      message: 'No check-in required today. Enjoy your rest!',
      showButton: false,
    };
  }

  // Assigned today but window is not open - show welcome message
  // If window IS open, fall through to the normal "window open" state so they can check in
  if (schedule.isAssignedToday && !schedule.windowOpen) {
    return {
      icon: <Sparkles className="h-10 w-10 text-blue-500" />,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      borderColor: 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20',
      title: 'Welcome to the team!',
      message: schedule.windowClosed
        ? `Today's check-in window has closed. Your first check-in starts tomorrow.`
        : `Your check-in window opens at ${formatTime12h(schedule.checkInStart)}.`,
      showButton: false,
    };
  }

  if (!schedule.windowOpen && !schedule.windowClosed) {
    return {
      icon: <Clock className="h-10 w-10 text-blue-500" />,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      borderColor: 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20',
      title: 'Check-in opens soon',
      message: `Your check-in window opens at ${formatTime12h(schedule.checkInStart)}.`,
      showButton: false,
    };
  }

  if (schedule.windowClosed) {
    return {
      icon: <AlertTriangle className="h-10 w-10 text-red-500" />,
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      borderColor: 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20',
      title: 'Check-in window closed',
      message: `Today's window closed at ${formatTime12h(schedule.checkInEnd)}. Contact your team lead if needed.`,
      showButton: false,
    };
  }

  // Window is open, worker should check in (including assigned-today workers)
  return {
    icon: <ClipboardCheck className="h-10 w-10 text-orange-500" />,
    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    borderColor: 'border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20',
    title: "You haven't checked in today",
    message: `Check-in window closes at ${formatTime12h(schedule.checkInEnd)}.`,
    showButton: true,
  };
}

export function WorkerDashboard() {
  const { data: stats, isLoading, error } = useDashboardStats();
  const { user } = useAuth();

  const hasData = stats && (stats.weeklyTrend?.length > 0 || stats.todayCheckIn);
  const hasCheckedInToday = !!stats?.todayCheckIn;

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="dashboard">
      {/* New worker - no data yet, show welcome state */}
      {!hasData ? (
        <div className="space-y-6">
          <PageHeader
            title={`Welcome, ${user?.firstName}!`}
            description="Let's get started with your first check-in"
          />

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Ready for your first check-in?</h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Daily check-ins help track your readiness and wellbeing. It only takes a minute!
                </p>
                {stats?.schedule && (() => {
                  const s = stats.schedule;
                  if (s.windowOpen) {
                    return (
                      <Button asChild size="lg">
                        <Link to={ROUTES.CHECK_IN}>
                          Start Check-In
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    );
                  }
                  if (s.isHoliday) {
                    return (
                      <p className="text-sm text-muted-foreground">
                        Today is a holiday{s.holidayName ? `: ${s.holidayName}` : ''}. No check-in required.
                      </p>
                    );
                  }
                  if (!s.isWorkDay) {
                    return (
                      <p className="text-sm text-muted-foreground">
                        No check-in required today. Come back on a work day!
                      </p>
                    );
                  }
                  if (s.isAssignedToday) {
                    return (
                      <p className="text-sm text-muted-foreground">
                        {s.windowClosed
                          ? "Today's check-in window has closed. Your first check-in starts tomorrow."
                          : `Your check-in window opens at ${formatTime12h(s.checkInStart)}.`}
                      </p>
                    );
                  }
                  if (!s.windowClosed) {
                    return (
                      <p className="text-sm text-muted-foreground">
                        Check-in window opens at {formatTime12h(s.checkInStart)}
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <PageHeader
            title={`Hi, ${user?.firstName}`}
            description="Your daily readiness overview"
            action={
              !hasCheckedInToday && stats?.schedule?.windowOpen ? (
                <Button asChild>
                  <Link to={ROUTES.CHECK_IN}>
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    Check-In Now
                  </Link>
                </Button>
              ) : undefined
            }
          />

          {/* Today's Check-in - Primary focus */}
          {hasCheckedInToday && stats?.todayCheckIn ? (
            <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <ReadinessIndicator
                    result={stats.todayCheckIn.readinessResult}
                    size="lg"
                    showLabel={false}
                  />
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex items-center gap-2 justify-center md:justify-start mb-3">
                      <Badge variant="success">Completed</Badge>
                      <span className="text-sm text-muted-foreground">Today's Check-In</span>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold">{stats.todayCheckIn.sleepHours}<span className="text-sm font-normal text-muted-foreground">h</span></p>
                        <p className="text-xs text-muted-foreground">Sleep</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{stats.todayCheckIn.sleepQuality}<span className="text-sm font-normal text-muted-foreground">/10</span></p>
                        <p className="text-xs text-muted-foreground">Quality</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{stats.todayCheckIn.fatigueLevel}<span className="text-sm font-normal text-muted-foreground">/10</span></p>
                        <p className="text-xs text-muted-foreground">Fatigue</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{stats.todayCheckIn.stressLevel}<span className="text-sm font-normal text-muted-foreground">/10</span></p>
                        <p className="text-xs text-muted-foreground">Stress</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : stats?.schedule && (
            (() => {
              const state = getNotCheckedInState(stats.schedule);
              return (
                <Card className={state.borderColor}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row items-center gap-6 py-4">
                      <div className={cn('w-20 h-20 rounded-full flex items-center justify-center', state.iconBg)}>
                        {state.icon}
                      </div>
                      <div className="flex-1 text-center md:text-left">
                        <h3 className="text-lg font-semibold">{state.title}</h3>
                        <p className="text-muted-foreground mb-4">{state.message}</p>
                        {state.showButton && (
                          <Button asChild>
                            <Link to={ROUTES.CHECK_IN}>
                              Submit Check-In
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()
          )}

          {/* View History link */}
          <div className="text-center">
            <Button asChild variant="ghost" size="sm">
              <Link to={ROUTES.CHECK_IN_HISTORY}>
                View Check-in History
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </PageLoader>
  );
}
