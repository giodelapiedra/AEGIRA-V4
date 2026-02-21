import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { useCompanySettings, useUpdateCompanySettings } from '../hooks/useCompanySettings';
import { useToast } from '@/lib/hooks/use-toast';
import {
  TIMEZONES,
  INDUSTRIES,
  BUSINESS_REGISTRATION_TYPES,
  BUSINESS_TYPES,
  COUNTRIES,
} from '@/config/company.config';
import type { CompanySettings } from '@/types/company.types';

const companySettingsSchema = z.object({
  companyName: z.string().min(1, 'Company name is required').max(100),
  timezone: z.string().min(1, 'Timezone is required'),
  industry: z.string(),
  businessRegistrationType: z.string(),
  businessRegistrationNumber: z.string(),
  businessType: z.string(),
  addressStreet: z.string().max(200),
  addressCity: z.string().max(100),
  addressPostalCode: z.string().max(20),
  addressState: z.string().max(100),
  addressCountry: z.string(),
});

type CompanySettingsForm = z.infer<typeof companySettingsSchema>;

export function AdminCompanySettingsPage() {
  const { data: settings, isLoading, error } = useCompanySettings();

  if (!settings && !isLoading) {
    return <ErrorMessage message="Failed to load settings" />;
  }

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="form">
      {settings && <CompanySettingsForm settings={settings} />}
    </PageLoader>
  );
}

interface CompanySettingsFormProps {
  settings: CompanySettings;
}

function CompanySettingsForm({ settings }: CompanySettingsFormProps) {
  const updateSettings = useUpdateCompanySettings();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CompanySettingsForm>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      companyName: settings.companyName,
      timezone: settings.timezone,
      industry: settings.industry,
      businessRegistrationType: settings.businessRegistrationType,
      businessRegistrationNumber: settings.businessRegistrationNumber,
      businessType: settings.businessType,
      addressStreet: settings.addressStreet,
      addressCity: settings.addressCity,
      addressPostalCode: settings.addressPostalCode,
      addressState: settings.addressState,
      addressCountry: settings.addressCountry,
    },
  });

  const selectedTimezone = watch('timezone');
  const selectedIndustry = watch('industry');
  const selectedRegType = watch('businessRegistrationType');
  const selectedBizType = watch('businessType');
  const selectedCountry = watch('addressCountry');

  const onSubmit = async (data: CompanySettingsForm) => {
    // Only send fields that actually changed
    const updates: Record<string, string> = {};
    const fields = [
      'companyName', 'timezone', 'industry',
      'businessRegistrationType', 'businessRegistrationNumber', 'businessType',
      'addressStreet', 'addressCity', 'addressPostalCode', 'addressState', 'addressCountry',
    ] as const;

    for (const field of fields) {
      if (data[field] !== settings[field]) {
        updates[field] = data[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      toast({ variant: 'warning', title: 'No changes', description: 'No modifications were detected.' });
      return;
    }

    try {
      await updateSettings.mutateAsync(updates);
      toast({
        variant: 'success',
        title: 'Settings saved',
        description: 'Company settings have been updated.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to save settings',
        description: error instanceof Error ? error.message : 'Something went wrong.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Settings"
        description="Configure company-wide settings"
      />

      <form onSubmit={handleSubmit(onSubmit)}>
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
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  {...register('companyName')}
                />
                {errors.companyName && (
                  <p className="text-sm text-destructive">{errors.companyName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Company Code</Label>
                <Input
                  value={settings.companyCode}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Company code cannot be changed</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Registration ID Type</Label>
                  <Select
                    value={selectedRegType || undefined}
                    onValueChange={(value) => setValue('businessRegistrationType', value, { shouldDirty: true })}
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
                  <Label htmlFor="businessRegistrationNumber">Registration Number</Label>
                  <Input
                    id="businessRegistrationNumber"
                    placeholder="e.g. 12 345 678 901"
                    {...register('businessRegistrationNumber')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Business Type</Label>
                  <Select
                    value={selectedBizType || undefined}
                    onValueChange={(value) => setValue('businessType', value, { shouldDirty: true })}
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
                    value={selectedIndustry || undefined}
                    onValueChange={(value) => setValue('industry', value, { shouldDirty: true })}
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
                  value={selectedTimezone}
                  onValueChange={(value) => setValue('timezone', value, { shouldDirty: true })}
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
                {errors.timezone && (
                  <p className="text-sm text-destructive">{errors.timezone.message}</p>
                )}
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
                <Label htmlFor="addressStreet">Street Address</Label>
                <Input
                  id="addressStreet"
                  placeholder="e.g. Unit 13/11-21 Waterloo St"
                  {...register('addressStreet')}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="addressCity">City</Label>
                  <Input
                    id="addressCity"
                    placeholder="e.g. Narrabeen"
                    {...register('addressCity')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addressPostalCode">Postal/Zip Code</Label>
                  <Input
                    id="addressPostalCode"
                    placeholder="e.g. 2101"
                    {...register('addressPostalCode')}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressState">State / Prov / Region</Label>
                <Input
                  id="addressState"
                  placeholder="e.g. NSW"
                  {...register('addressState')}
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Select
                  value={selectedCountry || undefined}
                  onValueChange={(value) => setValue('addressCountry', value, { shouldDirty: true })}
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

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={!isDirty || isSubmitting || updateSettings.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
}
