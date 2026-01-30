/**
 * Loading Skeleton Components
 *
 * Specialized loading skeletons for different chart and card types.
 * These provide better UX than generic spinners by showing the
 * expected layout of the content.
 */

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardCard } from "@/components/ui/dashboard-card";

/**
 * Loading skeleton for chart cards.
 * Shows title area, controls area, and chart placeholder.
 */
export function ChartSkeleton({
  className,
  showControls = true,
  height = "h-64",
}: {
  className?: string;
  showControls?: boolean;
  height?: string;
}) {
  return (
    <DashboardCard className={cn("animate-pulse p-6 flex flex-col gap-6", className)}>
      <div className="grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          {showControls && (
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-24" />
            </div>
          )}
        </div>
      </div>
      <div>
        <Skeleton className={cn("w-full rounded-lg", height)} />
      </div>
    </DashboardCard>
  );
}

/**
 * Loading skeleton for metric cards.
 * Shows title, value, and optional change indicator.
 */
export function MetricCardSkeleton({
  className,
  showChange = true,
}: {
  className?: string;
  showChange?: boolean;
}) {
  return (
    <DashboardCard className={cn("animate-pulse p-6 flex flex-col gap-6", className)}>
      <div className="grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 pb-2">
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-8 w-28" />
        {showChange && <Skeleton className="h-4 w-16" />}
      </div>
    </DashboardCard>
  );
}

/**
 * Loading skeleton for table rows.
 */
export function TableRowSkeleton({
  columns = 4,
  className,
}: {
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-4 py-3", className)}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === 0 ? "w-32" : i === columns - 1 ? "w-20" : "w-24"
          )}
        />
      ))}
    </div>
  );
}

/**
 * Loading skeleton for list items.
 */
export function ListItemSkeleton({
  showIcon = true,
  className,
}: {
  showIcon?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 py-2", className)}>
      {showIcon && <Skeleton className="h-8 w-8 rounded-full" />}
      <div className="flex-1 space-y-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

/**
 * Loading skeleton for sidebar navigation.
 */
export function SidebarSkeleton({
  items = 5,
  className,
}: {
  items?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2 p-4", className)}>
      <Skeleton className="mb-4 h-8 w-full" />
      {Array.from({ length: items }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

/**
 * Loading skeleton for the macro dashboard grid.
 */
export function MacroDashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Summary metrics row */}
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>

      {/* Charts grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSkeleton height="h-80" />
        <ChartSkeleton height="h-80" />
        <ChartSkeleton height="h-80" />
        <ChartSkeleton height="h-80" />
      </div>
    </div>
  );
}

/**
 * Loading skeleton for ticker analysis page.
 */
export function TickerPageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Header with search */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      {/* Main chart */}
      <ChartSkeleton height="h-96" />

      {/* Info cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCardSkeleton showChange />
        <MetricCardSkeleton showChange />
        <MetricCardSkeleton showChange={false} />
      </div>
    </div>
  );
}

/**
 * Inline loading indicator for small areas.
 */
export function InlineLoading({
  text = "Loading...",
  className,
}: {
  text?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      <span className="text-sm">{text}</span>
    </div>
  );
}

/**
 * Full-page loading state.
 */
export function PageLoading({
  message = "Loading...",
}: {
  message?: string;
}) {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
