import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLogin } from '../hooks/useLogin';
import { useToast } from '@/lib/hooks/use-toast';
import { ROUTES } from '@/config/routes.config';
import { Loader2 } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await loginMutation.mutateAsync(data);
      toast({
        variant: 'success',
        title: 'Welcome back!',
        description: 'You have successfully signed in.',
      });
      navigate(ROUTES.DASHBOARD);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Invalid credentials',
        description: error instanceof Error ? error.message : 'Please check your email and password and try again.',
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
          <div className="space-y-3 text-center max-w-sm">
            <h1 className="text-3xl font-bold leading-tight">
              <span className="text-gray-900">Workforce Safety</span>
              <br />
              <span className="text-primary">Made Simple</span>
            </h1>
            <p className="text-base text-gray-600 leading-relaxed">
              Monitor fatigue levels, ensure compliance, and keep your team safe with real-time check-ins and analytics.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
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
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Welcome back!</h2>
            <p className="mt-1 text-gray-500">Sign in to access your dashboard</p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-gray-700">Email</Label>
                <Input
                  type="email"
                  {...register('email')}
                  placeholder="name@company.com"
                  className="h-11 px-4 border-gray-200 rounded-lg"
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-gray-700">Password</Label>
                <Input
                  type="password"
                  {...register('password')}
                  placeholder="Enter your password"
                  className="h-11 px-4 border-gray-200 rounded-lg"
                />
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password.message}</p>
                )}
              </div>

              <div className="flex justify-end">
                <Link to="#" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base font-medium rounded-lg"
                disabled={isSubmitting || loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Log in'
                )}
              </Button>
            </form>
          </div>

          {/* Footer Links */}
          <div className="mt-8 text-center space-y-4">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <Link to={ROUTES.SIGNUP} className="text-primary font-medium hover:underline">
                Sign up here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
