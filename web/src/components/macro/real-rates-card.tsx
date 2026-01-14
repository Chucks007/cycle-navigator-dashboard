"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { useRealRates } from "@/hooks/use-data";
import { SyncedAreaChart } from "@/components/charts/synced-chart";
import { ExpandableChartCard } from "@/components/charts/expandable-chart-card";
import { calculateSMA, getFinancialStats } from "@/lib/financial-math";
import { TimeframeSelector, IndicatorToggle, type Timeframe } from "@/components/charts/chart-controls";
import { formatDate, filterByTimeframe } from "@/lib/formatters";
import { MetricSummarySidebar } from "@/components/macro/metric-summary-sidebar";

// Real Rates Card
export function RealRatesCard({ days }: { days?: number }) {
  const { data, isLoading, error } = useRealRates();
  
  // Local state for modal
  const [timeframe, setTimeframe] = React.useState<Timeframe>("1Y");
  const [showSMA, setShowSMA] = React.useState(false);

  const chartData = React.useMemo(() => {
    if (!data) return [];
    // Filter locally if days is provided (for grid view)
    let processed = data;
    if (days) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      processed = data.filter((d) => new Date(d.date) >= cutoff);
    }
    return processed.map((item) => ({
      ...item,
      date: item.date,
    }));
  }, [data, days]);
  
  // Create FULL dataset for modal (ignoring grid-level 'days' prop if we want full history)
  const fullData = React.useMemo(() => {
     if (!data) return [];
     return data.map((item) => ({
      ...item,
      date: item.date,
    }));
  }, [data]);

  // Derived detailed data using fullData
  const detailedData = React.useMemo(() => {
    const filtered = filterByTimeframe(fullData, timeframe);
    const values = filtered.map(d => d.real_rate);
    const sma = calculateSMA(values, 50); // 50-period for rates
    
    return filtered.map((d, i) => ({
      ...d,
      sma: sma[i]
    }));
  }, [fullData, timeframe]);

  // Stats
  const stats = React.useMemo(() => {
    const values = detailedData.map(d => d.real_rate);
    return getFinancialStats(values);
  }, [detailedData]);

  const latestRealRate = chartData.length > 0 ? chartData[0].real_rate : 0;
  const previousRealRate = chartData.length > 1 ? chartData[1].real_rate : latestRealRate;
  const rateChange = latestRealRate - previousRealRate;

  const getVariant = (): "default" | "success" | "warning" | "danger" => {
    if (latestRealRate < -1) return "danger";
    if (latestRealRate < 0) return "warning";
    return "success";
  };

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/50 bg-card/50 p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">Failed to load real rates</span>
        </div>
      </div>
    );
  }
  
  const detailedLines = [
    { dataKey: "real_rate", stroke: "#8b5cf6", name: "Real Rate (%)" },
    ...(showSMA ? [{ dataKey: "sma", stroke: "#fbbf24", name: "SMA (50)" }] : []),
  ];

  return (
    <ExpandableChartCard
      id="real-rates"
      title="Real Interest Rate"
      subtitle="10Y Treasury minus CPI"
      metricValue={`${latestRealRate.toFixed(2)}%`}
      metricChange={rateChange}
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
              dataKey: "real_rate",
              stroke: "#8b5cf6",
              name: "Real Rate (%)",
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
          formatYAxis={(v) => `${v.toFixed(1)}%`}
          height={400}
        />
      }
      modalActions={
        <div className="flex items-center gap-4">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
          <div className="h-6 w-px bg-border/50" />
          <IndicatorToggle label="SMA 50" checked={showSMA} onChange={setShowSMA} color="#fbbf24" />
        </div>
      }
      sidebarContent={
        <MetricSummarySidebar 
          stats={stats} 
          title="Rate Analysis"
          formatter={(v) => `${v.toFixed(2)}%`}
        />
      }
    />
  );
}
