import { Calendar } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function MySchedulePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Schedule"
        description="View your check-in schedule and upcoming days"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Check-in Calendar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-96 flex items-center justify-center text-muted-foreground">
              Calendar view coming soon...
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Check-in Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-muted-foreground">Your scheduled check-in days:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Monday</li>
                <li>Tuesday</li>
                <li>Wednesday</li>
                <li>Thursday</li>
                <li>Friday</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Company Holidays</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground">
              No upcoming holidays
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
