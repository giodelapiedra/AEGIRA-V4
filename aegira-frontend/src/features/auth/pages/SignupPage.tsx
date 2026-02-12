import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { useSignup } from '../hooks/useSignup';
import { useToast } from '@/lib/hooks/use-toast';
import { ROUTES } from '@/config/routes.config';
import {
  TIMEZONES,
  INDUSTRIES,
  BUSINESS_REGISTRATION_TYPES,
  BUSINESS_TYPES,
  COUNTRIES,
} from '@/config/company.config';
import { Loader2, Check, Building2, User, ArrowLeft, ArrowRight, MapPin } from 'lucide-react';

// Step 1: Personal Info Schema
const step1Schema = z
  .object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Please enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// Step 2: Company Info Schema
const step2Schema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  businessRegistrationType: z.string().min(1, 'Business registration ID type is required'),
  businessRegistrationNumber: z.string().min(1, 'Business registration number is required'),
  businessType: z.string().min(1, 'Business type is required'),
  industry: z.string().optional(),
  addressStreet: z.string().min(1, 'Street address is required'),
  addressCity: z.string().min(1, 'City is required'),
  addressPostalCode: z.string().min(1, 'Postal/Zip code is required'),
  addressState: z.string().min(1, 'State/Province/Region is required'),
  addressCountry: z.string().min(1, 'Country is required'),
  timezone: z.string().min(1, 'Timezone is required'),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

export function SignupPage() {
  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const navigate = useNavigate();
  const signupMutation = useSignup();
  const { toast } = useToast();

  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      companyName: '',
      businessRegistrationType: '',
      businessRegistrationNumber: '',
      businessType: '',
      industry: '',
      addressStreet: '',
      addressCity: '',
      addressPostalCode: '',
      addressState: '',
      addressCountry: '',
      timezone: 'Asia/Manila',
    },
  });

  const handleStep1Submit = (data: Step1Data) => {
    // Store data but clear confirmPassword (not needed after validation)
    setStep1Data({ ...data, confirmPassword: '' });
    setStep(2);
  };

  const handleStep2Submit = async (data: Step2Data) => {
    if (!step1Data) return;

    try {
      await signupMutation.mutateAsync({
        firstName: step1Data.firstName,
        lastName: step1Data.lastName,
        email: step1Data.email,
        password: step1Data.password,
        companyName: data.companyName,
        timezone: data.timezone,
        industry: data.industry,
        businessRegistrationType: data.businessRegistrationType,
        businessRegistrationNumber: data.businessRegistrationNumber,
        businessType: data.businessType,
        addressStreet: data.addressStreet,
        addressCity: data.addressCity,
        addressPostalCode: data.addressPostalCode,
        addressState: data.addressState,
        addressCountry: data.addressCountry,
      });
      // Clear sensitive data from state immediately after use
      setStep1Data(null);

      toast({
        variant: 'success',
        title: 'Account created!',
        description: `Welcome to AEGIRA, ${step1Data.firstName}!`,
      });
      navigate(ROUTES.DASHBOARD);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Registration failed',
        description: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      });
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gray-50">
        {/* Industrial Pattern Background */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `url('/assets/industrial-pattern.svg')`,
            backgroundSize: '300px 300px',
            backgroundRepeat: 'repeat',
          }}
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-blue-50/40" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full px-16 pb-24">
          {/* Logo */}
          <img src="/assets/aegira.svg" alt="Aegira" className="w-60 h-auto mb-6 saturate-[0.6] brightness-105 contrast-[0.9]" />

          {/* Tagline */}
          <div className="space-y-5 text-center max-w-sm">
            <h1 className="text-3xl font-bold leading-tight">
              <span className="text-gray-900">Start Protecting</span>
              <br />
              <span className="text-primary">Your Workforce</span>
            </h1>
            <div className="space-y-3 text-left">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="h-4 w-4 text-primary" />
                </div>
                <p className="text-muted-foreground">Real-time fatigue monitoring and check-ins</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="h-4 w-4 text-primary" />
                </div>
                <p className="text-muted-foreground">Team management and scheduling tools</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="h-4 w-4 text-primary" />
                </div>
                <p className="text-muted-foreground">Compliance reporting and analytics</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Signup Form */}
      <div className="flex-1 flex items-start pt-10 lg:items-start lg:pt-0 justify-center p-8 relative overflow-y-auto">
        {/* Dot Pattern Background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle, #c0c5cc 1.2px, transparent 1.2px)`,
            backgroundSize: '24px 24px',
          }}
        />
        <div className="absolute inset-0 bg-white/60" />

        <div className="relative z-10 w-full max-w-md py-10">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground">Create your account</h2>
            <p className="mt-1 text-muted-foreground">
              {step === 1 ? 'Enter your personal details' : 'Set up your company'}
            </p>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 1 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
              }`}>
                {step > 1 ? <Check className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <span className={`text-sm font-medium ${step >= 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
                Your Info
              </span>
            </div>
            <div className="flex-1 h-0.5 bg-muted">
              <div className={`h-full bg-primary transition-all duration-300 ${step >= 2 ? 'w-full' : 'w-0'}`} />
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 2 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
              }`}>
                <Building2 className="h-4 w-4" />
              </div>
              <span className={`text-sm font-medium ${step >= 2 ? 'text-foreground' : 'text-muted-foreground'}`}>
                Company
              </span>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
            {/* Step 1: Personal Information */}
            {step === 1 && (
              <form onSubmit={step1Form.handleSubmit(handleStep1Submit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-foreground">First name</Label>
                    <Input
                      type="text"
                      {...step1Form.register('firstName')}
                      placeholder="John"
                      className="h-11 px-4 border-input rounded-lg"
                    />
                    {step1Form.formState.errors.firstName && (
                      <p className="text-sm text-destructive">{step1Form.formState.errors.firstName.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Last name</Label>
                    <Input
                      type="text"
                      {...step1Form.register('lastName')}
                      placeholder="Doe"
                      className="h-11 px-4 border-input rounded-lg"
                    />
                    {step1Form.formState.errors.lastName && (
                      <p className="text-sm text-destructive">{step1Form.formState.errors.lastName.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">Work email</Label>
                  <Input
                    type="email"
                    {...step1Form.register('email')}
                    placeholder="you@company.com"
                    className="h-11 px-4 border-input rounded-lg"
                  />
                  {step1Form.formState.errors.email && (
                    <p className="text-sm text-destructive">{step1Form.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">Password</Label>
                  <Input
                    type="password"
                    {...step1Form.register('password')}
                    placeholder="Min. 8 characters"
                    className="h-11 px-4 border-input rounded-lg"
                  />
                  {step1Form.formState.errors.password && (
                    <p className="text-sm text-destructive">{step1Form.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">Confirm password</Label>
                  <Input
                    type="password"
                    {...step1Form.register('confirmPassword')}
                    placeholder="Re-enter password"
                    className="h-11 px-4 border-input rounded-lg"
                  />
                  {step1Form.formState.errors.confirmPassword && (
                    <p className="text-sm text-destructive">{step1Form.formState.errors.confirmPassword.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full h-11 text-base font-medium rounded-lg">
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            )}

            {/* Step 2: Company Information */}
            {step === 2 && (
              <form onSubmit={step2Form.handleSubmit(handleStep2Submit)} className="space-y-5">
                {/* --- Company Details Section --- */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Company Details</h3>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground">Company name</Label>
                    <Input
                      type="text"
                      {...step2Form.register('companyName')}
                      placeholder="Acme Corporation"
                      className="h-11 px-4 border-input rounded-lg"
                    />
                    {step2Form.formState.errors.companyName && (
                      <p className="text-sm text-destructive">{step2Form.formState.errors.companyName.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-foreground">Registration ID Type</Label>
                      <Controller
                        control={step2Form.control}
                        name="businessRegistrationType"
                        render={({ field }) => (
                          <Select value={field.value || undefined} onValueChange={field.onChange}>
                            <SelectTrigger className="h-11 border-input rounded-lg">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {BUSINESS_REGISTRATION_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {step2Form.formState.errors.businessRegistrationType && (
                        <p className="text-sm text-destructive">{step2Form.formState.errors.businessRegistrationType.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground">Registration Number</Label>
                      <Input
                        type="text"
                        {...step2Form.register('businessRegistrationNumber')}
                        placeholder="e.g. 12 345 678 901"
                        className="h-11 px-4 border-input rounded-lg"
                      />
                      {step2Form.formState.errors.businessRegistrationNumber && (
                        <p className="text-sm text-destructive">{step2Form.formState.errors.businessRegistrationNumber.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-foreground">Business Type</Label>
                      <Controller
                        control={step2Form.control}
                        name="businessType"
                        render={({ field }) => (
                          <Select value={field.value || undefined} onValueChange={field.onChange}>
                            <SelectTrigger className="h-11 border-input rounded-lg">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {BUSINESS_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {step2Form.formState.errors.businessType && (
                        <p className="text-sm text-destructive">{step2Form.formState.errors.businessType.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground">
                        Industry <span className="text-gray-400 font-normal">(optional)</span>
                      </Label>
                      <Controller
                        control={step2Form.control}
                        name="industry"
                        render={({ field }) => (
                          <Select value={field.value || undefined} onValueChange={field.onChange}>
                            <SelectTrigger className="h-11 border-input rounded-lg">
                              <SelectValue placeholder="Select industry" />
                            </SelectTrigger>
                            <SelectContent>
                              {INDUSTRIES.map((ind) => (
                                <SelectItem key={ind.value} value={ind.value}>{ind.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* --- Divider --- */}
                <div className="border-t border-border/50" />

                {/* --- Business Physical Address Section --- */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Business Physical Address</h3>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground">Street Address</Label>
                    <Input
                      type="text"
                      {...step2Form.register('addressStreet')}
                      placeholder="e.g. Unit 13/11-21 Waterloo St"
                      className="h-11 px-4 border-input rounded-lg"
                    />
                    {step2Form.formState.errors.addressStreet && (
                      <p className="text-sm text-destructive">{step2Form.formState.errors.addressStreet.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2 space-y-2">
                      <Label className="text-foreground">City</Label>
                      <Input
                        type="text"
                        {...step2Form.register('addressCity')}
                        placeholder="e.g. Narrabeen"
                        className="h-11 px-4 border-input rounded-lg"
                      />
                      {step2Form.formState.errors.addressCity && (
                        <p className="text-sm text-destructive">{step2Form.formState.errors.addressCity.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground">Postal/Zip Code</Label>
                      <Input
                        type="text"
                        {...step2Form.register('addressPostalCode')}
                        placeholder="e.g. 2101"
                        className="h-11 px-4 border-input rounded-lg"
                      />
                      {step2Form.formState.errors.addressPostalCode && (
                        <p className="text-sm text-destructive">{step2Form.formState.errors.addressPostalCode.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground">State / Prov / Region</Label>
                    <Input
                      type="text"
                      {...step2Form.register('addressState')}
                      placeholder="e.g. NSW"
                      className="h-11 px-4 border-input rounded-lg"
                    />
                    {step2Form.formState.errors.addressState && (
                      <p className="text-sm text-destructive">{step2Form.formState.errors.addressState.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground">Country</Label>
                    <Controller
                      control={step2Form.control}
                      name="addressCountry"
                      render={({ field }) => (
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                          <SelectTrigger className="h-11 border-input rounded-lg">
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRIES.map((country) => (
                              <SelectItem key={country.value} value={country.value}>{country.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {step2Form.formState.errors.addressCountry && (
                      <p className="text-sm text-destructive">{step2Form.formState.errors.addressCountry.message}</p>
                    )}
                  </div>
                </div>

                {/* --- Divider --- */}
                <div className="border-t border-border/50" />

                {/* --- Settings Section --- */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-foreground">Timezone</Label>
                    <Controller
                      control={step2Form.control}
                      name="timezone"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="h-11 border-input rounded-lg">
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIMEZONES.map((tz) => (
                              <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-11 text-base rounded-lg"
                    onClick={() => setStep(1)}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-11 text-base font-medium rounded-lg"
                    disabled={step2Form.formState.isSubmitting || signupMutation.isPending}
                  >
                    {signupMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create account'
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Footer Links */}
          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              Already have an account?{' '}
              <Link to={ROUTES.LOGIN} className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
