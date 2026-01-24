"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { useRealRates } from "@/hooks/use-data";
import { LightweightChart, SparklineChart } from "@/components/charts/lightweight-chart";
import { ExpandableChartCard } from "@/components/charts/expandable-chart-card";
import { calculateSMA, getFinancialStats } from "@/lib/financial-math";
import { TimeframeSelector, IndicatorToggle, LogScaleToggle } from "@/components/charts/chart-controls";
import { filterByTimeframe } from "@/lib/formatters";
import { MetricSummarySidebar } from "@/components/macro/metric-summary-sidebar";
import { transformToLineDataWithKey, type ChartDataPoint, type ExtraSeriesConfig } from "@/lib/chart-utils";
import { useRealRatesPrefs } from "@/stores/macro-preferences";

// Real Rates Card
export function RealRatesCard({ days }: { days?: number }) {
  const { data, isLoading, error } = useRealRates();
  
  // Get preferences from Zustand store (persisted)
  const {
    timeframe,
    setTimeframe,
    showSMA,
    logScale,
    setPrefs,
  } = useRealRatesPrefs();

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

  // Transform data for LightweightChart sparkline
  const sparklineData = React.useMemo((): ChartDataPoint[] => {
    return transformToLineDataWithKey(chartData, "real_rate");
  }, [chartData]);
  
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

  // Transform detailed data for LightweightChart
  const detailedChartData = React.useMemo((): ChartDataPoint[] => {
    return transformToLineDataWithKey(detailedData, "real_rate");
  }, [detailedData]);

  // Extra series for indicators (SMA)
  const extraSeries = React.useMemo((): ExtraSeriesConfig[] => {
    const series: ExtraSeriesConfig[] = [];
    
    if (showSMA) {
      const smaData = detailedData
        .filter(d => d.sma != null)
        .map(d => ({
          time: transformToLineDataWithKey([d], "real_rate")[0].time,
          value: d.sma as number
        }));
      if (smaData.length > 0) {
        series.push({
          data: smaData,
          color: "#fbbf24",
          lineWidth: 1,
          title: "SMA 50"
        });
      }
    }
    
    return series;
  }, [detailedData, showSMA]);

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
        <SparklineChart
          data={sparklineData}
          color="#8b5cf6"
          height={80}
        />
      }
      detailedChart={
        <LightweightChart
          data={detailedChartData}
          seriesType="Line"
          colors={{
            lineColor: "#8b5cf6",
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
          <IndicatorToggle label="SMA 50" checked={showSMA} onChange={(v) => setPrefs({ showSMA: v })} color="#fbbf24" />
          <div className="h-6 w-px bg-border/50" />
          <LogScaleToggle checked={logScale} onChange={(v) => setPrefs({ logScale: v })} />
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
