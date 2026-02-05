import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Building2, MapPin } from 'lucide-react';
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
import {
  TIMEZONES,
  INDUSTRIES,
  BUSINESS_REGISTRATION_TYPES,
  BUSINESS_TYPES,
  COUNTRIES,
} from '@/config/company.config';

interface CompanySettings {
  id: string;
  companyName: string;
  companyCode: string;
  timezone: string;
  industry: string;
  businessRegistrationType: string;
  businessRegistrationNumber: string;
  businessType: string;
  addressStreet: string;
  addressCity: string;
  addressPostalCode: string;
  addressState: string;
  addressCountry: string;
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
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (field: keyof CompanySettings, value: string) => {
    if (formData) {
      setFormData({ ...formData, [field]: value });
      setHasChanges(true);
    }
  };

  const handleSave = () => {
    if (!formData || !data) return;

    // Only send fields that actually changed
    const updates: Partial<CompanySettings> = {};
    const fields: (keyof CompanySettings)[] = [
      'companyName', 'timezone', 'industry',
      'businessRegistrationType', 'businessRegistrationNumber', 'businessType',
      'addressStreet', 'addressCity', 'addressPostalCode', 'addressState', 'addressCountry',
    ];

    for (const field of fields) {
      if (formData[field] !== data[field]) {
        updates[field] = formData[field];
      }
    }

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
        {/* Company Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Registration ID Type</Label>
                <Select
                  value={formData.businessRegistrationType || undefined}
                  onValueChange={(value) => handleChange('businessRegistrationType', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_REGISTRATION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Registration Number</Label>
                <Input
                  value={formData.businessRegistrationNumber}
                  onChange={(e) => handleChange('businessRegistrationNumber', e.target.value)}
                  placeholder="e.g. 12 345 678 901"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Business Type</Label>
                <Select
                  value={formData.businessType || undefined}
                  onValueChange={(value) => handleChange('businessType', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Industry</Label>
                <Select
                  value={formData.industry || undefined}
                  onValueChange={(value) => handleChange('industry', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((ind) => (
                      <SelectItem key={ind.value} value={ind.value}>{ind.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Business Physical Address Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Business Physical Address
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Street Address</Label>
              <Input
                value={formData.addressStreet}
                onChange={(e) => handleChange('addressStreet', e.target.value)}
                placeholder="e.g. Unit 13/11-21 Waterloo St"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>City</Label>
                <Input
                  value={formData.addressCity}
                  onChange={(e) => handleChange('addressCity', e.target.value)}
                  placeholder="e.g. Narrabeen"
                />
              </div>
              <div className="space-y-2">
                <Label>Postal/Zip Code</Label>
                <Input
                  value={formData.addressPostalCode}
                  onChange={(e) => handleChange('addressPostalCode', e.target.value)}
                  placeholder="e.g. 2101"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>State / Prov / Region</Label>
              <Input
                value={formData.addressState}
                onChange={(e) => handleChange('addressState', e.target.value)}
                placeholder="e.g. NSW"
              />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Select
                value={formData.addressCountry || undefined}
                onValueChange={(value) => handleChange('addressCountry', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country.value} value={country.value}>{country.label}</SelectItem>
                  ))}
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
