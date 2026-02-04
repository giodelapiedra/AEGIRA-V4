import { FileText, Download } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function TeamReportsPage() {
  const reportTypes = [
    {
      title: 'Weekly Summary',
      description: 'Summary of team check-ins and readiness for the past week',
      icon: <FileText className="h-8 w-8" />,
    },
    {
      title: 'Monthly Report',
      description: 'Comprehensive monthly report with trends and analytics',
      icon: <FileText className="h-8 w-8" />,
    },
    {
      title: 'Compliance Report',
      description: 'Check-in compliance rates and missed check-ins',
      icon: <FileText className="h-8 w-8" />,
    },
    {
      title: 'High-Risk Incidents',
      description: 'Report of all high-risk incidents and follow-up actions',
      icon: <FileText className="h-8 w-8" />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Reports"
        description="Generate and download team reports"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reportTypes.map((report) => (
          <Card key={report.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {report.icon}
                {report.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">{report.description}</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">
                  Generate
                </Button>
                <Button variant="outline" size="icon">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Custom Report</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Generate a custom report with specific date range and filters.
          </p>
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label>Start Date</Label>
              <Input type="date" />
            </div>
            <div className="flex-1 space-y-2">
              <Label>End Date</Label>
              <Input type="date" />
            </div>
            <Button>Generate Report</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
