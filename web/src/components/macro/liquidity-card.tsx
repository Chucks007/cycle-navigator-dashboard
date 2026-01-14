"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { useLiquidity } from "@/hooks/use-data";
import { SyncedAreaChart } from "@/components/charts/synced-chart";
import { ExpandableChartCard } from "@/components/charts/expandable-chart-card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { calculateSMA, calculateEMA, getFinancialStats } from "@/lib/financial-math";
import { TimeframeSelector, IndicatorToggle, type Timeframe } from "@/components/charts/chart-controls";
import { formatLargeNumber, formatDate, filterByTimeframe } from "@/lib/formatters";
import { MetricSummarySidebar } from "@/components/macro/metric-summary-sidebar";

// Liquidity (M2) Chart Component
export function LiquidityCard({ days }: { days?: number }) {
  const { data, isLoading, error } = useLiquidity(days);
  const [adjustForInflation, setAdjustForInflation] = React.useState(false);
  
  // Local state for modal
  const [timeframe, setTimeframe] = React.useState<Timeframe>("1Y");
  const [showSMA, setShowSMA] = React.useState(false);
  const [showEMA, setShowEMA] = React.useState(false);

  // Use full data from backend (filtered by days)
  const chartData = React.useMemo(() => {
    if (!data) return [];
    const mapped = data.map((item) => ({
      ...item,
      date: item.date,
      value: item.value,
      growth_rate: (item.growth_rate ?? 0) * 100,
    }));
    return mapped;
  }, [data]);

  // Derived data for detailed view (Filtered by local timeframe + Indicators)
  const detailedData = React.useMemo(() => {
    const filtered = filterByTimeframe(chartData, timeframe);
    
    // Calculate indicators on filtered data
    const values = filtered.map(d => d.value);
    const sma = calculateSMA(values, 20); // 20-period SMA
    const ema = calculateEMA(values, 20); // 20-period EMA
    
    return filtered.map((d, i) => ({
      ...d,
      sma: sma[i],
      ema: ema[i]
    }));
  }, [chartData, timeframe]);

  // Stats for the sidebar
  const stats = React.useMemo(() => {
    const values = detailedData.map(d => d.value);
    return getFinancialStats(values);
  }, [detailedData]);

  const latestValue = chartData.length > 0 ? chartData[0].value : 0;
  const latestGrowth = chartData.length > 0 ? chartData[0].growth_rate : 0;

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/50 bg-card/50 p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">Failed to load M2 data</span>
        </div>
      </div>
    );
  }

  // Define chart lines for detailed view
  const detailedLines = [
    { dataKey: "value", stroke: "#3b82f6", name: "M2 (Billions)" },
    ...(showSMA ? [{ dataKey: "sma", stroke: "#fbbf24", name: "SMA (20)" }] : []),
    ...(showEMA ? [{ dataKey: "ema", stroke: "#8b5cf6", name: "EMA (20)" }] : [])
  ];

  return (
    <ExpandableChartCard
      id="m2-liquidity"
      title="M2 Money Supply"
      subtitle="Federal Reserve monetary aggregate"
      metricValue={formatLargeNumber(latestValue * 1e9)}
      metricChange={latestGrowth}
      changeLabel="YoY"
      variant={latestGrowth > 0 ? "success" : "danger"}
      isLoading={isLoading}
      condensedChart={
        <SyncedAreaChart
          data={chartData}
          xDataKey="date"
          mode="condensed"
          lines={[
            {
              dataKey: "value",
              stroke: "#3b82f6",
              name: "M2 (Billions)",
            },
          ]}
          height={80}
        />
      }
      detailedChart={
        <SyncedAreaChart
          data={detailedData}
          xDataKey="date"
          syncId="macro-charts-modal"
          mode="detailed"
          lines={detailedLines}
          formatXAxis={formatDate}
          formatYAxis={(v) => `$${(v / 1000).toFixed(0)}T`}
          height={400}
        />
      }
      modalActions={
        <>
           <div className="flex items-center gap-4">
            <TimeframeSelector value={timeframe} onChange={setTimeframe} />
            <div className="h-6 w-px bg-border/50" />
            <IndicatorToggle label="SMA 20" checked={showSMA} onChange={setShowSMA} color="#fbbf24" />
            <IndicatorToggle label="EMA 20" checked={showEMA} onChange={setShowEMA} color="#8b5cf6" />
           </div>
           
           {/* Original switch kept separate if needed, or merged */}
           <div className="flex items-center space-x-2">
            <Switch
              id="inflation-adjust-m2-modal"
              checked={adjustForInflation}
              onCheckedChange={setAdjustForInflation}
            />
            <Label htmlFor="inflation-adjust-m2-modal" className="text-sm text-muted-foreground cursor-pointer">
              CPI Adj
            </Label>
          </div>
        </>
      }
      sidebarContent={
        <MetricSummarySidebar 
          stats={stats} 
          title="Liquidity Analysis" 
          formatter={(v) => formatLargeNumber(v * 1e9)}
        />
      }
    />
  );
}
