// Simple Page Loader - Shows skeleton while loading, error message on error
// Much simpler than QueryWrapper - no render props needed

import { ErrorMessage } from './ErrorMessage';
import {
  PageSkeleton,
  StatCardsSkeleton,
  CardGridSkeleton,
  TableSkeleton,
  DashboardSkeleton,
  TeamLeadDashboardSkeleton,
  FormSkeleton,
  DetailSkeleton,
  DetailContentSkeleton,
  CheckInSkeleton,
} from './skeletons';

export type SkeletonType =
  | 'page'
  | 'dashboard'
  | 'team-lead-dashboard'
  | 'table'
  | 'cards'
  | 'form'
  | 'detail'
  | 'detail-content'
  | 'check-in'
  | 'stats';

interface PageLoaderProps {
  isLoading: boolean;
  error?: Error | null;
  skeleton?: SkeletonType;
  children: React.ReactNode;
}

// Get skeleton component by type
function getSkeleton(type: SkeletonType): React.ReactNode {
  const skeletons: Record<SkeletonType, React.ReactNode> = {
    page: <PageSkeleton />,
    dashboard: <DashboardSkeleton />,
    'team-lead-dashboard': <TeamLeadDashboardSkeleton />,
    table: <TableSkeleton />,
    cards: <PageSkeleton><CardGridSkeleton /></PageSkeleton>,
    form: <FormSkeleton />,
    detail: <DetailSkeleton />,
    'detail-content': <DetailContentSkeleton />,
    'check-in': <CheckInSkeleton />,
    stats: <PageSkeleton><StatCardsSkeleton /></PageSkeleton>,
  };
  return skeletons[type] || <PageSkeleton />;
}

/**
 * Simple page loader - just wrap your content
 *
 * Usage:
 * ```tsx
 * const { data, isLoading, error } = useQuery({...});
 *
 * return (
 *   <PageLoader isLoading={isLoading} error={error} skeleton="table">
 *     <YourContent data={data} />
 *   </PageLoader>
 * );
 * ```
 */
export function PageLoader({ isLoading, error, skeleton = 'page', children }: PageLoaderProps) {
  if (isLoading) {
    return <>{getSkeleton(skeleton)}</>;
  }

  if (error) {
    return <ErrorMessage message={error.message} />;
  }

  return <>{children}</>;
}

// Re-export individual skeletons for custom use
export {
  PageSkeleton,
  StatCardsSkeleton,
  CardGridSkeleton,
  TableSkeleton,
  DashboardSkeleton,
  TeamLeadDashboardSkeleton,
  FormSkeleton,
  DetailSkeleton,
  DetailContentSkeleton,
  CheckInSkeleton,
} from './skeletons';
