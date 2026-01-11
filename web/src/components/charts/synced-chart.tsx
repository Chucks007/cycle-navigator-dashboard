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

interface ChartContainerProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function ChartContainer({
  children,
  className,
  title,
  subtitle,
  actions,
}: ChartContainerProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-xl",
        className
      )}
    >
      {/* Glassmorphism effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />

      <div className="relative z-10">
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
      </div>
    </div>
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
}

export function SyncedAreaChart({
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
      <AreaChart
        data={data}
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
              <stop offset="5%" stopColor={line.stroke} stopOpacity={0.3} />
              <stop offset="95%" stopColor={line.stroke} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
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
