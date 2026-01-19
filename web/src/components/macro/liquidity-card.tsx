"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { useLiquidity, useCpi } from "@/hooks/use-data";
import { LightweightChart, SparklineChart } from "@/components/charts/lightweight-chart";
import { ExpandableChartCard } from "@/components/charts/expandable-chart-card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { calculateSMA, calculateEMA, getFinancialStats } from "@/lib/financial-math";
import { TimeframeSelector, IndicatorToggle, LogScaleToggle, PurchasingPowerToggle, type Timeframe } from "@/components/charts/chart-controls";
import { formatLargeNumber, filterByTimeframe } from "@/lib/formatters";
import { MetricSummarySidebar } from "@/components/macro/metric-summary-sidebar";
import { transformToLineDataWithKey, type ChartDataPoint, type ExtraSeriesConfig } from "@/lib/chart-utils";
import { adjustSeriesByCPI, type SeriesPoint } from "@/lib/series-utils";

// Liquidity (M2) Chart Component
export function LiquidityCard({ days }: { days?: number }) {
  const { data, isLoading, error } = useLiquidity(days);
  const [adjustForInflation, setAdjustForInflation] = React.useState(false);

  // Fetch CPI data when adjustment is enabled
  const { data: cpiData, isLoading: cpiLoading } = useCpi(adjustForInflation ? days : undefined);

  // Local state for modal
  const [timeframe, setTimeframe] = React.useState<Timeframe>("1Y");
  const [showSMA, setShowSMA] = React.useState(false);
  const [showEMA, setShowEMA] = React.useState(false);
  const [logScale, setLogScale] = React.useState(false);

  // Use full data from backend (filtered by days)
  const chartData = React.useMemo(() => {
    if (!data) return [];

    // Base data mapping
    const mapped = data.map((item) => ({
      ...item,
      date: item.date,
      value: item.value,
      growth_rate: (item.growth_rate ?? 0) * 100,
    }));

    // Apply CPI adjustment if enabled and CPI data is available
    if (adjustForInflation && cpiData && cpiData.length > 0) {
      const m2Series: SeriesPoint[] = mapped.map(d => ({ date: d.date, value: d.value }));
      const cpiSeries: SeriesPoint[] = cpiData.map(d => ({ date: d.date, value: d.value }));

      // Adjust M2 by CPI and index to 100
      const adjustedSeries = adjustSeriesByCPI(m2Series, cpiSeries, true, true);

      // Merge adjusted values back into mapped data
      return mapped
        .map(item => {
          const adjusted = adjustedSeries.find(a => a.date === item.date);
          if (adjusted) {
            return {
              ...item,
              value: adjusted.value, // Replace with indexed purchasing power value
            };
          }
          return null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
    }

    return mapped;
  }, [data, adjustForInflation, cpiData]);

  // Transform data for LightweightChart sparkline
  const sparklineData = React.useMemo((): ChartDataPoint[] => {
    return transformToLineDataWithKey(chartData, "value");
  }, [chartData]);

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

  // Transform detailed data for LightweightChart
  const detailedChartData = React.useMemo((): ChartDataPoint[] => {
    return transformToLineDataWithKey(detailedData, "value");
  }, [detailedData]);

  // Extra series for indicators (SMA, EMA)
  const extraSeries = React.useMemo((): ExtraSeriesConfig[] => {
    const series: ExtraSeriesConfig[] = [];

    if (showSMA) {
      const smaData = detailedData
        .filter(d => d.sma != null)
        .map(d => ({
          time: transformToLineDataWithKey([d], "value")[0].time,
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

    if (showEMA) {
      const emaData = detailedData
        .filter(d => d.ema != null)
        .map(d => ({
          time: transformToLineDataWithKey([d], "value")[0].time,
          value: d.ema as number
        }));
      if (emaData.length > 0) {
        series.push({
          data: emaData,
          color: "#8b5cf6",
          lineWidth: 1,
          title: "EMA 20"
        });
      }
    }

    return series;
  }, [detailedData, showSMA, showEMA]);

  // Formatter for axis and legend
  const priceFormat = React.useMemo(() => ({
    type: 'custom' as const,
    formatter: (price: number) => {
      if (adjustForInflation) {
        // Show as index value when CPI-adjusted
        return price.toFixed(1);
      }
      if (price >= 1000) return `$${(price / 1000).toFixed(2)}T`;
      return `$${price.toFixed(0)}B`;
    }
  }), [adjustForInflation]);

  // Stats for the sidebar
  const stats = React.useMemo(() => {
    const values = detailedData.map(d => d.value);
    return getFinancialStats(values);
  }, [detailedData]);

  const latestValue = chartData.length > 0 ? chartData[0].value : 0;
  const latestGrowth = chartData.length > 0 ? chartData[0].growth_rate : 0;
  const firstDate = detailedData.length > 0 ? detailedData[0].date : null;

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

  return (
    <ExpandableChartCard
      id="m2-liquidity"
      title="M2 Money Supply"
      subtitle={adjustForInflation ? "Purchasing power (CPI-adjusted, indexed to 100)" : "Federal Reserve monetary aggregate"}
      metricValue={adjustForInflation ? latestValue.toFixed(1) : formatLargeNumber(latestValue * 1e9)}
      metricChange={latestGrowth}
      changeLabel="YoY"
      variant={latestGrowth > 0 ? "success" : "danger"}
      isLoading={isLoading}
      condensedChart={
        <SparklineChart
          data={sparklineData}
          color="#3b82f6"
          height={80}
        />
      }
      detailedChart={
        <div className="space-y-2">
          <LightweightChart
            data={detailedChartData}
            seriesType="Area"
            colors={{
              lineColor: "#3b82f6",
              topColor: "rgba(59, 130, 246, 0.4)",
              bottomColor: "rgba(59, 130, 246, 0.0)",
            }}
            extraSeries={extraSeries}
            logScale={logScale}
            height={400}
            fitContent
            priceFormat={priceFormat}
          />
          {adjustForInflation && firstDate && (
            <p className="text-xs text-muted-foreground text-center">
              Indexed to 100 at {new Date(firstDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>
      }
      modalActions={
        <>
          <div className="flex items-center gap-4">
            <TimeframeSelector value={timeframe} onChange={setTimeframe} />
            <div className="h-6 w-px bg-border/50" />
            <IndicatorToggle label="SMA 20" checked={showSMA} onChange={setShowSMA} color="#fbbf24" />
            <IndicatorToggle label="EMA 20" checked={showEMA} onChange={setShowEMA} color="#8b5cf6" />
            <div className="h-6 w-px bg-border/50" />
            <LogScaleToggle checked={logScale} onChange={setLogScale} />
            <div className="h-6 w-px bg-border/50" />
            <PurchasingPowerToggle
              checked={adjustForInflation}
              onChange={setAdjustForInflation}
              type="CPI"
              disabled={cpiLoading}
            />
          </div>
        </>
      }
      sidebarContent={
        <MetricSummarySidebar
          stats={stats}
          title={adjustForInflation ? "Real M2 Analysis (CPI-Adj)" : "Liquidity Analysis"}
          formatter={(v) => adjustForInflation ? v.toFixed(1) : formatLargeNumber(v * 1e9)}
        />
      }
    />
  );
}
