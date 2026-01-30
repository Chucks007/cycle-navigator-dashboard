"use client";

import { DashboardCard } from "@/components/ui/dashboard-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Target,
  Shield,
  Percent,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StockFundamentals } from "@/types/api";

// ===========================
// Types
// ===========================

interface FinancialsTableProps {
  data: StockFundamentals | undefined;
  isLoading: boolean;
  error: Error | null;
  currentPrice?: number;
}

interface MetricItemProps {
  label: string;
  value: string | number | null | undefined;
  icon?: React.ReactNode;
  format?: "currency" | "percent" | "number" | "ratio";
  suffix?: string;
  highlight?: "positive" | "negative" | "neutral";
}

// ===========================
// Formatting Utilities
// ===========================

function formatValue(
  value: string | number | null | undefined,
  format: "currency" | "percent" | "number" | "ratio" = "number",
  suffix?: string
): string {
  if (value === null || value === undefined) return "N/A";

  const numValue = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(numValue)) return "N/A";

  let formatted: string;

  switch (format) {
    case "currency":
      if (numValue >= 1e12) {
        formatted = `$${(numValue / 1e12).toFixed(2)}T`;
      } else if (numValue >= 1e9) {
        formatted = `$${(numValue / 1e9).toFixed(2)}B`;
      } else if (numValue >= 1e6) {
        formatted = `$${(numValue / 1e6).toFixed(2)}M`;
      } else {
        formatted = `$${numValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      break;
    case "percent":
      formatted = `${(numValue * 100).toFixed(2)}%`;
      break;
    case "ratio":
      formatted = numValue.toFixed(2);
      break;
    default:
      formatted = numValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return suffix ? `${formatted}${suffix}` : formatted;
}

function getHighlight(
  value: number | null | undefined,
  thresholds: { positive?: number; negative?: number; inverse?: boolean }
): "positive" | "negative" | "neutral" {
  if (value === null || value === undefined) return "neutral";
  
  const { positive, negative, inverse } = thresholds;
  
  if (inverse) {
    if (negative !== undefined && value > negative) return "negative";
    if (positive !== undefined && value < positive) return "positive";
  } else {
    if (positive !== undefined && value > positive) return "positive";
    if (negative !== undefined && value < negative) return "negative";
  }
  
  return "neutral";
}

// ===========================
// Components
// ===========================

function MetricItem({ label, value, icon, format = "number", suffix, highlight = "neutral" }: MetricItemProps) {
  const formattedValue = formatValue(value, format, suffix);
  const isNA = formattedValue === "N/A";

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon && <span className="text-muted-foreground/70">{icon}</span>}
        <span>{label}</span>
      </div>
      <span
        className={cn(
          "text-sm font-medium tabular-nums",
          isNA && "text-muted-foreground/50",
          !isNA && highlight === "positive" && "text-emerald-500",
          !isNA && highlight === "negative" && "text-red-500",
          !isNA && highlight === "neutral" && "text-foreground"
        )}
      >
        {formattedValue}
      </span>
    </div>
  );
}

function MetricSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        {title}
      </h4>
      <div className="space-y-0">{children}</div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <DashboardCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-4 w-20" />
            {[...Array(4)].map((_, j) => (
              <div key={j} className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

// ===========================
// Main Component
// ===========================

export function FinancialsTable({ data, isLoading, error, currentPrice }: FinancialsTableProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <DashboardCard className="p-6">
        <h3 className="text-lg font-semibold mb-4">Fundamentals</h3>
        <p className="text-muted-foreground text-center py-8">
          Unable to load fundamental data. {error.message}
        </p>
      </DashboardCard>
    );
  }

  if (!data) {
    return (
      <DashboardCard className="p-6">
        <h3 className="text-lg font-semibold mb-4">Fundamentals</h3>
        <p className="text-muted-foreground text-center py-8">
          No fundamental data available for this ticker.
        </p>
      </DashboardCard>
    );
  }

  // Calculate 52-week position
  const fiftyTwoWeekPosition =
    data.fifty_two_week_high && data.fifty_two_week_low && currentPrice
      ? ((currentPrice - data.fifty_two_week_low) /
          (data.fifty_two_week_high - data.fifty_two_week_low)) *
        100
      : null;

  return (
    <DashboardCard className="p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">Fundamentals</h3>
          {data.name && (
            <span className="text-sm text-muted-foreground truncate max-w-[200px]">
              {data.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data.sector && (
            <Badge variant="secondary" className="text-xs">
              <Building2 className="w-3 h-3 mr-1" />
              {data.sector}
            </Badge>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Valuation Section */}
        <MetricSection title="Valuation">
          <MetricItem
            label="Market Cap"
            value={data.market_cap}
            icon={<DollarSign className="w-3.5 h-3.5" />}
            format="currency"
          />
          <MetricItem
            label="P/E (Trailing)"
            value={data.trailing_pe}
            icon={<BarChart3 className="w-3.5 h-3.5" />}
            format="ratio"
            highlight={getHighlight(data.trailing_pe, { negative: 50, inverse: true })}
          />
          <MetricItem
            label="Forward P/E"
            value={data.forward_pe}
            icon={<Target className="w-3.5 h-3.5" />}
            format="ratio"
            highlight={getHighlight(data.forward_pe, { negative: 40, inverse: true })}
          />
          <MetricItem
            label="Price/Sales"
            value={data.price_to_sales}
            icon={<BarChart3 className="w-3.5 h-3.5" />}
            format="ratio"
          />
        </MetricSection>

        {/* Risk & Position Section */}
        <MetricSection title="Risk & Position">
          <MetricItem
            label="Beta"
            value={data.beta}
            icon={<Shield className="w-3.5 h-3.5" />}
            format="ratio"
            highlight={getHighlight(data.beta, { positive: 0.8, negative: 1.5 })}
          />
          <MetricItem
            label="52-Week High"
            value={data.fifty_two_week_high}
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            format="currency"
          />
          <MetricItem
            label="52-Week Low"
            value={data.fifty_two_week_low}
            icon={<TrendingDown className="w-3.5 h-3.5" />}
            format="currency"
          />
          <MetricItem
            label="Debt/Equity"
            value={data.debt_to_equity}
            icon={<BarChart3 className="w-3.5 h-3.5" />}
            format="ratio"
            highlight={getHighlight(data.debt_to_equity, { negative: 200, inverse: true })}
          />
        </MetricSection>

        {/* Profitability Section */}
        <MetricSection title="Profitability">
          <MetricItem
            label="EPS (Trailing)"
            value={data.trailing_eps}
            icon={<DollarSign className="w-3.5 h-3.5" />}
            format="currency"
            highlight={getHighlight(data.trailing_eps, { positive: 0, negative: 0 })}
          />
          <MetricItem
            label="Profit Margin"
            value={data.profit_margin}
            icon={<Percent className="w-3.5 h-3.5" />}
            format="percent"
            highlight={getHighlight(data.profit_margin, { positive: 0.1, negative: 0 })}
          />
          <MetricItem
            label="Dividend Yield"
            value={data.dividend_yield}
            icon={<Percent className="w-3.5 h-3.5" />}
            format="percent"
            highlight={getHighlight(data.dividend_yield, { positive: 0.02 })}
          />
        </MetricSection>
      </div>

      {/* 52-Week Range Bar */}
      {fiftyTwoWeekPosition !== null && (
        <div className="mt-6 pt-4 border-t border-border/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>52-Week Range</span>
            <span className="font-medium text-foreground">
              {fiftyTwoWeekPosition.toFixed(0)}% from low
            </span>
          </div>
          <div className="relative h-2 bg-muted/30 rounded-full overflow-hidden">
            <div
              className={cn(
                "absolute top-0 left-0 h-full rounded-full transition-all duration-500",
                fiftyTwoWeekPosition > 80
                  ? "bg-red-500"
                  : fiftyTwoWeekPosition < 20
                    ? "bg-emerald-500"
                    : "bg-primary"
              )}
              style={{ width: `${fiftyTwoWeekPosition}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-foreground rounded-full border-2 border-background shadow-sm"
              style={{ left: `calc(${fiftyTwoWeekPosition}% - 4px)` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{formatValue(data.fifty_two_week_low, "currency")}</span>
            <span>{formatValue(data.fifty_two_week_high, "currency")}</span>
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
