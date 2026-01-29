"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { DashboardCard } from "@/components/ui/dashboard-card";

interface ChartContainerProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  onClick?: () => void;
  interactive?: boolean;
}

export function ChartContainer({
  children,
  className,
  title,
  subtitle,
  actions,
  onClick,
  interactive = false,
}: ChartContainerProps) {
  return (
    <DashboardCard
      variant={interactive ? "interactive" : "default"}
      className={cn("p-6", className)}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive && onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {(title || actions) && (
        <div className="mb-6 flex items-center justify-between">
          <div>
            {title && <h3 className="text-lg font-semibold">{title}</h3>}
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      {children}
    </DashboardCard>
  );
}

interface SyncedChartProps {
  data: Record<string, unknown>[];
  xDataKey: string;
  lines: {
    dataKey: string;
    stroke: string;
    name?: string;
    type?: "line" | "area";
    gradientId?: string;
  }[];
  height?: number;
  syncId?: string;
  formatXAxis?: (value: string) => string;
  formatYAxis?: (value: number) => string;
  formatTooltip?: (value: number, name: string) => string;
  /** Chart display mode: 'condensed' for sparklines, 'detailed' for full interactivity */
  mode?: 'condensed' | 'detailed';
}

// Memoized sparkline component for performance in grid view
const SparklineChart = React.memo(function SparklineChart({
  data,
  xDataKey,
  lines,
  height = 80,
}: Pick<SyncedChartProps, 'data' | 'xDataKey' | 'lines' | 'height'>) {
  // Downsample data for sparklines (take every nth point)
  const sampledData = React.useMemo(() => {
    if (data.length <= 50) return data;
    const step = Math.ceil(data.length / 50);
    return data.filter((_, i) => i % step === 0);
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={sampledData}
        margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
      >
        <defs>
          {lines.map((line) => (
            <linearGradient
              key={`sparkline-gradient-${line.dataKey}`}
              id={`sparkline-gradient-${line.dataKey}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="5%" stopColor={line.stroke} stopOpacity={0.3} />
              <stop offset="95%" stopColor={line.stroke} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        {lines.map((line) => (
          <Area
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            stroke={line.stroke}
            strokeWidth={1.5}
            strokeOpacity={0.8}
            fill={`url(#sparkline-gradient-${line.dataKey})`}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
});

export function SyncedAreaChart({
  data,
  xDataKey,
  lines,
  height = 300,
  syncId,
  formatXAxis,
  formatYAxis,
  formatTooltip,
  mode = 'detailed',
}: SyncedChartProps) {
  // Parse dates to timestamps to ensure X-axis scales correctly
  const processedData = React.useMemo(() => {
    return data.map((item) => {
      const val = item[xDataKey];
      // Check if this looks like a date string (YYYY-MM-DD) or similar
      if (typeof val === "string" && !isNaN(Date.parse(val))) {
        return { ...item, [xDataKey]: new Date(val).getTime() };
      }
      return item;
    });
  }, [data, xDataKey]);

  // For condensed mode, render optimized sparkline
  if (mode === 'condensed') {
    return (
      <SparklineChart
        data={data}
        xDataKey={xDataKey}
        lines={lines}
        height={height}
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={processedData}
        syncId={syncId}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          {lines.map((line) => (
            <linearGradient
              key={`gradient-${line.dataKey}`}
              id={line.gradientId || `gradient-${line.dataKey}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="5%" stopColor={line.stroke} stopOpacity={0.5} />
              <stop offset="95%" stopColor={line.stroke} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.1)"
          vertical={false}
        />
        <XAxis
          dataKey={xDataKey}
          tickFormatter={formatXAxis}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          className="text-muted-foreground"
          type="number"
          domain={['dataMin', 'dataMax']}
          scale="time"
        />
        <YAxis
          tickFormatter={formatYAxis}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          className="text-muted-foreground"
          width={60}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            borderColor: "hsl(var(--border))",
            borderRadius: "8px",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
          }}
          labelStyle={{ color: "hsl(var(--foreground))" }}
          formatter={
            formatTooltip
              ? (value, name) => [
                  formatTooltip(typeof value === 'number' ? value : 0, String(name)),
                  name,
                ]
              : undefined
          }
           labelFormatter={(value) => {
            if (typeof value === 'number') {
              return new Date(value).toLocaleDateString("en-US", { month: "short", year: "numeric", day: "numeric" });
            }
            return String(value);
          }}
        />
        {lines.map((line) => (
          <Area
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={line.name || line.dataKey}
            stroke={line.stroke}
            strokeWidth={2}
            fill={`url(#${line.gradientId || `gradient-${line.dataKey}`})`}
            dot={false}
            activeDot={{
              r: 4,
              stroke: line.stroke,
              strokeWidth: 2,
              fill: "hsl(var(--background))",
            }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SyncedLineChart({
  data,
  xDataKey,
  lines,
  height = 300,
  syncId,
  formatXAxis,
  formatYAxis,
  formatTooltip,
}: SyncedChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        syncId={syncId}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="currentColor"
          className="text-border/30"
          vertical={false}
        />
        <XAxis
          dataKey={xDataKey}
          tickFormatter={formatXAxis}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          className="text-muted-foreground"
        />
        <YAxis
          tickFormatter={formatYAxis}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          className="text-muted-foreground"
          width={60}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            borderColor: "hsl(var(--border))",
            borderRadius: "8px",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
          }}
          labelStyle={{ color: "hsl(var(--foreground))" }}
          formatter={
            formatTooltip
              ? (value, name) => [
                  formatTooltip(typeof value === 'number' ? value : 0, String(name)),
                  name,
                ]
              : undefined
          }
        />
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={line.name || line.dataKey}
            stroke={line.stroke}
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 4,
              stroke: line.stroke,
              strokeWidth: 2,
              fill: "hsl(var(--background))",
            }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg bg-muted/20"
      style={{ height }}
    >
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        <span className="text-sm">Loading chart...</span>
      </div>
    </div>
  );
}
