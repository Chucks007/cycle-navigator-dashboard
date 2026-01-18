"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { useDebtStatus } from "@/hooks/use-data";
import { LightweightChart, SparklineChart } from "@/components/charts/lightweight-chart";
import { ExpandableChartCard } from "@/components/charts/expandable-chart-card";
import { calculateSMA, getFinancialStats } from "@/lib/financial-math";
import { TimeframeSelector, IndicatorToggle, LogScaleToggle, type Timeframe } from "@/components/charts/chart-controls";
import { filterByTimeframe } from "@/lib/formatters";
import { MetricSummarySidebar } from "@/components/macro/metric-summary-sidebar";
import { transformToLineDataWithKey, type ChartDataPoint, type ExtraSeriesConfig } from "@/lib/chart-utils";

// Debt Status Card
export function DebtStatusCard({ days }: { days?: number }) {
  const { data, isLoading, error } = useDebtStatus(days);
  
  // Local state for modal
  const [timeframe, setTimeframe] = React.useState<Timeframe>("1Y");
  const [showSMA, setShowSMA] = React.useState(false);
  const [logScale, setLogScale] = React.useState(false);
  
  const chartData = React.useMemo(() => {
    if (!data) return [];
    return data.map((item) => ({
      ...item,
      date: item.date,
    }));
  }, [data]);

  // Transform data for LightweightChart sparkline
  const sparklineData = React.useMemo((): ChartDataPoint[] => {
    return transformToLineDataWithKey(chartData, "ratio");
  }, [chartData]);

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

  // Transform detailed data for LightweightChart
  const detailedChartData = React.useMemo((): ChartDataPoint[] => {
    return transformToLineDataWithKey(detailedData, "ratio");
  }, [detailedData]);

  // Extra series for indicators (SMA)
  const extraSeries = React.useMemo((): ExtraSeriesConfig[] => {
    const series: ExtraSeriesConfig[] = [];
    
    if (showSMA) {
      const smaData = detailedData
        .filter(d => d.sma != null)
        .map(d => ({
          time: transformToLineDataWithKey([d], "ratio")[0].time,
          value: d.sma as number
        }));
      if (smaData.length > 0) {
        series.push({
          data: smaData,
          color: "#fbbf24",
          lineWidth: 1,
          title: "SMA 20"
        });
      }
    }
    
    return series;
  }, [detailedData, showSMA]);

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
        <SparklineChart
          data={sparklineData}
          color="#10b981"
          height={80}
        />
      }
      detailedChart={
        <LightweightChart
          data={detailedChartData}
          seriesType="Line"
          colors={{
            lineColor: "#10b981",
          }}
          extraSeries={extraSeries}
          logScale={logScale}
          height={400}
          fitContent
        />
      }
      modalActions={
        <div className="flex items-center gap-4">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
          <div className="h-6 w-px bg-border/50" />
          <IndicatorToggle label="SMA 20" checked={showSMA} onChange={setShowSMA} color="#fbbf24" />
          <div className="h-6 w-px bg-border/50" />
          <LogScaleToggle checked={logScale} onChange={setLogScale} />
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
