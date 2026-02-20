import { Navigate } from 'react-router-dom';
import { useSession } from '@/features/auth/hooks/useSession';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ROUTES } from '@/config/routes.config';

interface GuestGuardProps {
  children: React.ReactNode;
}

/**
 * Inverse of RouteGuard — only allows unauthenticated users.
 * Redirects authenticated users to the dashboard.
 */
export function GuestGuard({ children }: GuestGuardProps) {
  const { data, isLoading, isError } = useSession();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // If user has a valid session, redirect to dashboard
  if (!isError && data?.user) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <>{children}</>;
}
