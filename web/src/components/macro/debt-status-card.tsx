"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { useDebtStatus } from "@/hooks/use-data";
import { SyncedAreaChart } from "@/components/charts/synced-chart";
import { ExpandableChartCard } from "@/components/charts/expandable-chart-card";
import { calculateSMA, getFinancialStats } from "@/lib/financial-math";
import { TimeframeSelector, IndicatorToggle, type Timeframe } from "@/components/charts/chart-controls";
import { formatDate, filterByTimeframe } from "@/lib/formatters";
import { MetricSummarySidebar } from "@/components/macro/metric-summary-sidebar";

// Debt Status Card
export function DebtStatusCard({ days }: { days?: number }) {
  const { data, isLoading, error } = useDebtStatus(days);
  
  // Local state for modal
  const [timeframe, setTimeframe] = React.useState<Timeframe>("1Y");
  const [showSMA, setShowSMA] = React.useState(false);
  
  const chartData = React.useMemo(() => {
    if (!data) return [];
    return data.map((item) => ({
      ...item,
      date: item.date,
    }));
  }, [data]);

  // Derived detailed data
  const detailedData = React.useMemo(() => {
    const filtered = filterByTimeframe(chartData, timeframe);
    const values = filtered.map(d => d.ratio);
    const sma = calculateSMA(values, 20);
    
    return filtered.map((d, i) => ({
      ...d,
      sma: sma[i]
    }));
  }, [chartData, timeframe]);

  // Stats
  const stats = React.useMemo(() => {
    const values = detailedData.map(d => d.ratio);
    return getFinancialStats(values);
  }, [detailedData]);

  const latestRatio = chartData.length > 0 ? chartData[0].ratio : 0;
  const previousRatio = chartData.length > 1 ? chartData[1].ratio : latestRatio;
  const ratioChange = latestRatio - previousRatio;

  const getVariant = (): "default" | "success" | "warning" | "danger" => {
    if (latestRatio > 30) return "danger";
    if (latestRatio > 20) return "warning";
    return "default";
  };

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/50 bg-card/50 p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">Failed to load debt data</span>
        </div>
      </div>
    );
  }

  const detailedLines = [
    { dataKey: "ratio", stroke: "#10b981", name: "Ratio (%)" },
    ...(showSMA ? [{ dataKey: "sma", stroke: "#fbbf24", name: "SMA (20)" }] : []),
  ];

  return (
    <ExpandableChartCard
      id="debt-status"
      title="Interest-to-Tax Ratio"
      subtitle="Fiscal stress indicator"
      metricValue={`${latestRatio.toFixed(1)}%`}
      metricChange={ratioChange}
      changeLabel="MoM"
      variant={getVariant()}
      isLoading={isLoading}
      condensedChart={
        <SyncedAreaChart
          data={chartData}
          xDataKey="date"
          mode="condensed"
          lines={[
            {
              dataKey: "ratio",
              stroke: "#10b981",
              name: "Ratio (%)",
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
          formatYAxis={(v) => `${v.toFixed(0)}%`}
          height={400}
        />
      }
      modalActions={
        <div className="flex items-center gap-4">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
          <div className="h-6 w-px bg-border/50" />
          <IndicatorToggle label="SMA 20" checked={showSMA} onChange={setShowSMA} color="#fbbf24" />
        </div>
      }
      sidebarContent={
        <MetricSummarySidebar 
          stats={stats} 
          title="Debt Analysis"
          formatter={(v) => `${v.toFixed(2)}%`}
        />
      }
    />
  );
}
