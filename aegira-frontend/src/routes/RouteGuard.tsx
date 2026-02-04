import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '@/features/auth/hooks/useSession';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ROUTES } from '@/config/routes.config';
import type { UserRole } from '@/types/auth.types';

interface RouteGuardProps {
  children?: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function RouteGuard({ children, allowedRoles }: RouteGuardProps) {
  const { data, isLoading, isError } = useSession();
  const location = useLocation();

  // Wait for session check before deciding
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // No valid session — redirect to login
  if (isError || !data?.user) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  // Check role-based access
  if (allowedRoles && !allowedRoles.includes(data.user.role)) {
    return <Navigate to={ROUTES.UNAUTHORIZED} replace />;
  }

  // If used as a layout route, render Outlet; otherwise render children
  return children ? <>{children}</> : <Outlet />;
}
