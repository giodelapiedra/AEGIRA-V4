// Centralized Skeleton Components
// Modern loading states that mimic actual content layout

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

// ============================================
// PAGE SKELETON - Generic page with header
// ============================================
export function PageSkeleton({ children }: { children?: React.ReactNode }) {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      {children}
    </div>
  );
}

// ============================================
// STAT CARDS SKELETON - For dashboard stats
// ============================================
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={cn('grid gap-4', {
      'grid-cols-1 md:grid-cols-2 lg:grid-cols-4': count === 4,
      'grid-cols-1 md:grid-cols-3': count === 3,
      'grid-cols-1 md:grid-cols-2': count === 2,
    })}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
            <Skeleton className="h-3 w-20 mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================
// CARD GRID SKELETON - For member cards, etc.
// ============================================
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-32" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: count }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-40" />
                    <div className="flex gap-2 mt-2">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                  </div>
                </div>
                <Skeleton className="h-8 w-full mt-4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// TABLE SKELETON - For data tables
// ============================================
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-64" /> {/* Search */}
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          {/* Header */}
          <div className="border-b bg-muted/50 p-4">
            <div className="flex gap-4">
              {Array.from({ length: columns }).map((_, i) => (
                <Skeleton key={i} className="h-4 flex-1" />
              ))}
            </div>
          </div>
          {/* Rows */}
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="border-b p-4 last:border-0">
              <div className="flex gap-4 items-center">
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <Skeleton
                    key={colIndex}
                    className={cn('h-4 flex-1', {
                      'max-w-[200px]': colIndex === 0,
                    })}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// DASHBOARD SKELETON - Worker/Team Lead dashboard
// ============================================
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Main Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="flex-1 space-y-4 text-center md:text-left">
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-28" />
              </div>
              <div className="grid grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="text-center space-y-1">
                    <Skeleton className="h-8 w-12 mx-auto" />
                    <Skeleton className="h-3 w-10 mx-auto" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <StatCardsSkeleton count={3} />

      {/* Chart Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-8 w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-10" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// TEAM LEAD DASHBOARD SKELETON
// ============================================
export function TeamLeadDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Stats */}
      <StatCardsSkeleton count={4} />

      {/* Team Status Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-40" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// FORM SKELETON - For edit/create pages
// ============================================
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-6">
          {Array.from({ length: fields }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <div className="flex gap-3 pt-4">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-20" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// DETAIL PAGE SKELETON - For view pages
// ============================================
export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      <DetailContentSkeleton />
    </div>
  );
}

// ============================================
// DETAIL CONTENT SKELETON - Cards only (no header)
// Used when the page header renders outside PageLoader
// ============================================
export function DetailContentSkeleton() {
  return (
    <div className="space-y-6">
      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================
// CHECK-IN PAGE SKELETON
// ============================================
export function CheckInSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton className="h-4 w-64 mx-auto" />
      </div>

      {/* Progress */}
      <div className="flex justify-center gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-2 w-16 rounded-full" />
        ))}
      </div>

      {/* Form Card */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="text-center space-y-2">
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </div>

          {/* Slider */}
          <div className="space-y-4 py-8">
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-4 w-8" />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-between pt-4">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
