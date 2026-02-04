import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PageLoader } from '@/components/common/PageLoader';
import { PageHeader } from '@/components/common/PageHeader';
import { CheckInFormComplete } from '../components/CheckInFormComplete';
import { ReadinessIndicator } from '../components/ReadinessIndicator';
import { useTodayCheckIn } from '../hooks/useTodayCheckIn';
import { useCheckInStatus } from '../hooks/useCheckInStatus';
import { ROUTES } from '@/config/routes.config';
import { formatDateTime } from '@/lib/utils/date.utils';
import { cn } from '@/lib/utils/cn';
import { formatTime12h, formatScheduleWindow } from '@/lib/utils/format.utils';
import { History, Moon, Battery, Brain, Heart, Clock, Calendar, AlertCircle, Users } from 'lucide-react';

// Helper function to convert work day number to name
function getWorkDayName(day: string): string {
  const days: Record<string, string> = {
    '0': 'Sun',
    '1': 'Mon',
    '2': 'Tue',
    '3': 'Wed',
    '4': 'Thu',
    '5': 'Fri',
    '6': 'Sat',
  };
  return days[day] || day;
}

export function CheckInPage() {
  const navigate = useNavigate();
  const { data: todayCheckIn, isLoading: isLoadingCheckIn } = useTodayCheckIn();
  const { data: status, isLoading: isLoadingStatus } = useCheckInStatus();

  const isLoading = isLoadingCheckIn || isLoadingStatus;

  // Already submitted today - show summary
  const renderCompletedCheckIn = () => {
    if (!todayCheckIn) return null;
    const readinessResult = todayCheckIn.readinessResult;

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHeader
          title="Daily Check-In"
          description="Your check-in for today has been recorded"
          action={
            <Button variant="outline" onClick={() => navigate(ROUTES.CHECK_IN_HISTORY)}>
              <History className="mr-2 h-4 w-4" />
              View History
            </Button>
          }
        />

        <Card>
          <CardHeader className="text-center">
            <Badge variant="success" className="mx-auto mb-2">
              Completed
            </Badge>
            <CardTitle>Today's Readiness</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {readinessResult && (
              <div className="flex justify-center">
                <ReadinessIndicator result={readinessResult} size="lg" />
              </div>
            )}

            {readinessResult?.recommendations && readinessResult.recommendations.length > 0 && (
              <div className="bg-muted rounded-lg p-4">
                <h4 className="font-medium mb-2">Recommendations</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {readinessResult.recommendations.map((rec) => (
                    <li key={rec} className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <Moon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">{todayCheckIn.sleepHours}h</p>
                <p className="text-xs text-muted-foreground">Sleep</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <Battery className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">{todayCheckIn.fatigueLevel}/10</p>
                <p className="text-xs text-muted-foreground">Fatigue</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <Brain className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">{todayCheckIn.stressLevel}/10</p>
                <p className="text-xs text-muted-foreground">Stress</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <Heart className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">{todayCheckIn.painLevel}/10</p>
                <p className="text-xs text-muted-foreground">Pain</p>
              </div>
            </div>

            {readinessResult?.factors && readinessResult.factors.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-3">Readiness Factors</h4>
                  <div className="space-y-2">
                    {readinessResult.factors.map((factor) => (
                      <div
                        key={factor.name}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{factor.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-secondary rounded-full h-2">
                            <div
                              className={cn(
                                'h-2 rounded-full',
                                factor.impact === 'positive' && 'bg-green-500',
                                factor.impact === 'neutral' && 'bg-yellow-500',
                                factor.impact === 'negative' && 'bg-red-500'
                              )}
                              style={{ width: `${factor.value * 10}%` }}
                            />
                          </div>
                          <span
                            className={cn(
                              'w-16 text-right font-medium',
                              factor.impact === 'positive' && 'text-green-600',
                              factor.impact === 'neutral' && 'text-yellow-600',
                              factor.impact === 'negative' && 'text-red-600'
                            )}
                          >
                            {factor.impact}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            <p className="text-sm text-muted-foreground text-center">
              Submitted at {formatDateTime(todayCheckIn.submittedAt)}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Cannot check in - show message
  const renderCannotCheckIn = () => {
    if (!status || status.canCheckIn || status.hasCheckedInToday) return null;

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHeader
          title="Daily Check-In"
          description="Check-in not available at this time"
          action={
            <Button variant="outline" onClick={() => navigate(ROUTES.CHECK_IN_HISTORY)}>
              <History className="mr-2 h-4 w-4" />
              View History
            </Button>
          }
        />

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle>Check-In Not Available</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-center text-muted-foreground">{status.message}</p>

            {status.team && (
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Team: {status.team.name}</span>
                </div>

                {status.schedule && (
                  <>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Check-in Window: {formatScheduleWindow(status.schedule.checkInStart, status.schedule.checkInEnd)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Work Days: {status.schedule.workDays.map(getWorkDayName).join(', ')}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {status.isHoliday && (
              <p className="text-sm text-muted-foreground text-center">
                Today is a company holiday{status.holidayName ? `: ${status.holidayName}` : ''}. No check-in required. Enjoy your day!
              </p>
            )}

            {!status.isHoliday && !status.isWorkDay && (
              <p className="text-sm text-muted-foreground text-center">
                Today is not a scheduled work day. Enjoy your day off!
              </p>
            )}

            {!status.isHoliday && status.isWorkDay && !status.isWithinWindow && (
              <p className="text-sm text-muted-foreground text-center">
                {status.schedule?.checkInStart && new Date().toTimeString().slice(0, 5) < status.schedule.checkInStart
                  ? `The check-in window will open at ${formatTime12h(status.schedule.checkInStart)}`
                  : `The check-in window has closed for today`}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // Can check in - show form
  const renderCheckInForm = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Daily Check-In"
        description="Complete your readiness assessment for today"
      />
      {status?.team && (
        <div className="bg-muted rounded-lg p-3 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>Team: {status.team.name}</span>
          </div>
          {status.schedule && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Window: {formatScheduleWindow(status.schedule.checkInStart, status.schedule.checkInEnd)}</span>
            </div>
          )}
        </div>
      )}
      <CheckInFormComplete />
    </div>
  );

  return (
    <PageLoader isLoading={isLoading} error={null} skeleton="check-in">
      {todayCheckIn ? renderCompletedCheckIn() :
       (status && !status.canCheckIn && !status.hasCheckedInToday) ? renderCannotCheckIn() :
       renderCheckInForm()}
    </PageLoader>
  );
}
