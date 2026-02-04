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
import { Loader2, Check, Building2, User, ArrowLeft, ArrowRight } from 'lucide-react';

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
  timezone: z.string().min(1, 'Timezone is required'),
  industry: z.string().optional(),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

const TIMEZONES = [
  { value: 'Asia/Manila', label: 'Manila (GMT+8)' },
  { value: 'Asia/Singapore', label: 'Singapore (GMT+8)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (GMT+8)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (GMT+9)' },
  { value: 'Asia/Seoul', label: 'Seoul (GMT+9)' },
  { value: 'Australia/Sydney', label: 'Sydney (GMT+11)' },
  { value: 'America/New_York', label: 'New York (GMT-5)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (GMT-8)' },
  { value: 'Europe/London', label: 'London (GMT+0)' },
];

const INDUSTRIES = [
  { value: '', label: 'Select your industry' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'construction', label: 'Construction' },
  { value: 'mining', label: 'Mining & Resources' },
  { value: 'logistics', label: 'Logistics & Transport' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'retail', label: 'Retail' },
  { value: 'technology', label: 'Technology' },
  { value: 'other', label: 'Other' },
];

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
      timezone: 'Asia/Manila',
      industry: '',
    },
  });

  const handleStep1Submit = (data: Step1Data) => {
    setStep1Data(data);
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
      });
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
                <p className="text-gray-600">Real-time fatigue monitoring and check-ins</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="h-4 w-4 text-primary" />
                </div>
                <p className="text-gray-600">Team management and scheduling tools</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="h-4 w-4 text-primary" />
                </div>
                <p className="text-gray-600">Compliance reporting and analytics</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Signup Form */}
      <div className="flex-1 flex items-start pt-20 lg:items-center lg:pt-0 justify-center p-8 relative">
        {/* Dot Pattern Background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle, #c0c5cc 1.2px, transparent 1.2px)`,
            backgroundSize: '24px 24px',
          }}
        />
        <div className="absolute inset-0 bg-white/60" />

        <div className="relative z-10 w-full max-w-md">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
            <p className="mt-1 text-gray-500">
              {step === 1 ? 'Enter your personal details' : 'Set up your company'}
            </p>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 1 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {step > 1 ? <Check className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <span className={`text-sm font-medium ${step >= 1 ? 'text-gray-900' : 'text-gray-400'}`}>
                Your Info
              </span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200">
              <div className={`h-full bg-primary transition-all duration-300 ${step >= 2 ? 'w-full' : 'w-0'}`} />
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 2 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                <Building2 className="h-4 w-4" />
              </div>
              <span className={`text-sm font-medium ${step >= 2 ? 'text-gray-900' : 'text-gray-400'}`}>
                Company
              </span>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            {/* Step 1: Personal Information */}
            {step === 1 && (
              <form onSubmit={step1Form.handleSubmit(handleStep1Submit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-700">First name</Label>
                    <Input
                      type="text"
                      {...step1Form.register('firstName')}
                      placeholder="John"
                      className="h-11 px-4 border-gray-200 rounded-lg"
                    />
                    {step1Form.formState.errors.firstName && (
                      <p className="text-sm text-red-500">{step1Form.formState.errors.firstName.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700">Last name</Label>
                    <Input
                      type="text"
                      {...step1Form.register('lastName')}
                      placeholder="Doe"
                      className="h-11 px-4 border-gray-200 rounded-lg"
                    />
                    {step1Form.formState.errors.lastName && (
                      <p className="text-sm text-red-500">{step1Form.formState.errors.lastName.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700">Work email</Label>
                  <Input
                    type="email"
                    {...step1Form.register('email')}
                    placeholder="you@company.com"
                    className="h-11 px-4 border-gray-200 rounded-lg"
                  />
                  {step1Form.formState.errors.email && (
                    <p className="text-sm text-red-500">{step1Form.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700">Password</Label>
                  <Input
                    type="password"
                    {...step1Form.register('password')}
                    placeholder="Min. 8 characters"
                    className="h-11 px-4 border-gray-200 rounded-lg"
                  />
                  {step1Form.formState.errors.password && (
                    <p className="text-sm text-red-500">{step1Form.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700">Confirm password</Label>
                  <Input
                    type="password"
                    {...step1Form.register('confirmPassword')}
                    placeholder="Re-enter password"
                    className="h-11 px-4 border-gray-200 rounded-lg"
                  />
                  {step1Form.formState.errors.confirmPassword && (
                    <p className="text-sm text-red-500">{step1Form.formState.errors.confirmPassword.message}</p>
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
              <form onSubmit={step2Form.handleSubmit(handleStep2Submit)} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-gray-700">Company name</Label>
                  <Input
                    type="text"
                    {...step2Form.register('companyName')}
                    placeholder="Acme Corporation"
                    className="h-11 px-4 border-gray-200 rounded-lg"
                  />
                  {step2Form.formState.errors.companyName && (
                    <p className="text-sm text-red-500">{step2Form.formState.errors.companyName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700">Timezone</Label>
                  <Controller
                    control={step2Form.control}
                    name="timezone"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="h-11 border-gray-200 rounded-lg">
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

                <div className="space-y-2">
                  <Label className="text-gray-700">
                    Industry <span className="text-gray-400 font-normal">(optional)</span>
                  </Label>
                  <Controller
                    control={step2Form.control}
                    name="industry"
                    render={({ field }) => (
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <SelectTrigger className="h-11 border-gray-200 rounded-lg">
                          <SelectValue placeholder="Select your industry" />
                        </SelectTrigger>
                        <SelectContent>
                          {INDUSTRIES.filter((ind) => ind.value !== '').map((ind) => (
                            <SelectItem key={ind.value} value={ind.value}>{ind.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
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
            <p className="text-gray-600">
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
