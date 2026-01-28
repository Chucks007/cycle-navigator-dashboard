"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { DashboardCard } from "@/components/ui/dashboard-card";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  className?: string;
  variant?: "default" | "success" | "warning" | "danger";
}

export function MetricCard({
  title,
  value,
  subtitle,
  change,
  changeLabel,
  icon,
  className,
  variant = "default",
}: MetricCardProps) {
  const getTrendIcon = () => {
    if (change === undefined || change === null) return null;
    if (change > 0) return <TrendingUp className="h-4 w-4" />;
    if (change < 0) return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  const getTrendColor = () => {
    if (change === undefined || change === null) return "text-muted-foreground";
    if (change > 0) return "text-emerald-500";
    if (change < 0) return "text-red-500";
    return "text-muted-foreground";
  };

  return (
    <DashboardCard
      className={cn(
        "p-6 transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
        variant !== "default" && "border-opacity-100",
        variant === "success" && "border-emerald-500/20 bg-emerald-500/5",
        variant === "warning" && "border-amber-500/20 bg-amber-500/5",
        variant === "danger" && "border-red-500/20 bg-red-500/5",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        )}
      </div>
      
      <div className="mt-3">
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      
      {change !== undefined && (
        <div className={cn("mt-4 flex items-center gap-1.5 text-sm", getTrendColor())}>
          {getTrendIcon()}
          <span className="font-medium">
            {change > 0 ? "+" : ""}
            {typeof change === "number" ? change.toFixed(2) : change}%
          </span>
          {changeLabel && (
            <span className="text-muted-foreground">{changeLabel}</span>
          )}
        </div>
      )}
    </DashboardCard>
  );
}

interface MetricCardSkeletonProps {
  className?: string;
}

export function MetricCardSkeleton({ className }: MetricCardSkeletonProps) {
  return (
    <DashboardCard className={cn("p-6", className)}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded bg-muted" />
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
      </div>
    </DashboardCard>
  );
}
