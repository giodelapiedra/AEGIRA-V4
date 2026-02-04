import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCog, Save } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageLoader } from '@/components/common/PageLoader';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import { useToast } from '@/lib/hooks/use-toast';

interface CompanySettings {
  id: string;
  companyName: string;
  companyCode: string;
  timezone: string;
}

export function AdminCompanySettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formData, setFormData] = useState<CompanySettings | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'company-settings'],
    staleTime: STALE_TIMES.STATIC, // Settings rarely change
    queryFn: () => apiClient.get<CompanySettings>(ENDPOINTS.ADMIN.COMPANY_SETTINGS),
  });

  const saveMutation = useMutation({
    mutationFn: (data: Partial<CompanySettings>) =>
      apiClient.patch(ENDPOINTS.ADMIN.COMPANY_SETTINGS, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'company-settings'] });
      toast({ variant: 'success', title: 'Settings saved', description: 'Company settings have been updated.' });
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to save settings', description: error.message || 'Something went wrong.' });
    },
  });

  useEffect(() => {
    if (data && !formData) {
      setFormData(data);
    }
  }, [data]); // ✅ FIX: Removed formData from dependencies to prevent infinite loop

  const handleChange = (field: keyof CompanySettings, value: string | boolean | number) => {
    if (formData) {
      setFormData({ ...formData, [field]: value });
      setHasChanges(true);
    }
  };

  const handleSave = () => {
    if (!formData || !data) return;

    // Only send fields that actually changed
    const updates: Partial<CompanySettings> = {};
    if (formData.companyName !== data.companyName) updates.companyName = formData.companyName;
    if (formData.timezone !== data.timezone) updates.timezone = formData.timezone;
    if (Object.keys(updates).length === 0) {
      toast({ title: 'No changes', description: 'No modifications were detected.' });
      setHasChanges(false);
      return;
    }

    saveMutation.mutate(updates);
  };

  if (!formData && !isLoading) {
    return <ErrorMessage message="Failed to load settings" />;
  }

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="form">
    {formData && (
    <div className="space-y-6">
      <PageHeader
        title="Company Settings"
        description="Configure company-wide settings"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Company Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={formData.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Company Code</Label>
              <Input
                value={formData.companyCode}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Company code cannot be changed</p>
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) => handleChange('timezone', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Manila">Asia/Manila</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">America/New_York</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                  <SelectItem value="Asia/Singapore">Asia/Singapore</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
    )}
    </PageLoader>
  );
}
