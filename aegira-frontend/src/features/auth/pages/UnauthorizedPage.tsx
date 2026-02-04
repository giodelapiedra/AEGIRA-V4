import { Link } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ROUTES } from '@/config/routes.config';

export function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <ShieldX className="h-16 w-16 text-destructive" />
          </div>
          <CardTitle>Access Denied</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            You don't have permission to access this page.
          </p>
          <Button asChild>
            <Link to={ROUTES.DASHBOARD}>Go to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
