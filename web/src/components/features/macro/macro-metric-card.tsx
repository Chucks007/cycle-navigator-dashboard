"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { LightweightChart, SparklineChart } from "@/components/charts/lightweight-chart";
import { ExpandableChartCard } from "@/components/charts/expandable-chart-card";
import { calculateSMA, calculateEMA, getFinancialStats } from "@/lib/financial-math";
import { TimeframeSelector, IndicatorToggle, LogScaleToggle, PurchasingPowerToggle, type Timeframe } from "@/components/charts/chart-controls";
import { filterByTimeframe } from "@/lib/formatters";
import { MetricSummarySidebar } from "@/components/features/macro/metric-summary-sidebar";
import { transformToLineDataWithKey, createIndicatorSeries, type ChartDataPoint, type ExtraSeriesConfig } from "@/lib/transformations";

/**
 * Base data structure for macro metrics
 */
export interface MacroDataPoint {
  date: string;
  [key: string]: number | string;
}

/**
 * Configuration for the MacroMetricCard component
 */
export interface MacroMetricCardConfig<T extends MacroDataPoint> {
  // Card identification and metadata
  id: string;
  title: string;
  subtitle: string;
  
  // Data and loading state
  data: T[] | undefined;
  isLoading: boolean;
  error: Error | null;
  
  // Value extraction
  valueKey: keyof T;
  
  // Optional additional data for adjustments (e.g., CPI)
  adjustmentData?: Array<{ date: string; value: number }>;
  
  // Chart configuration
  chartColor: string;
  seriesType?: "Line" | "Area";
  chartHeight?: number;
  
  // Preferences
  timeframe: Timeframe;
  setTimeframe: (value: Timeframe) => void;
  showSMA?: boolean;
  showEMA?: boolean;
  logScale?: boolean;
  adjustForInflation?: boolean;
  setPrefs: (prefs: Partial<Pick<MacroMetricCardConfig<T>, 'showSMA' | 'showEMA' | 'logScale' | 'adjustForInflation'>>) => void;
  
  // Indicator configuration
  smaWindow?: number;
  emaWindow?: number;
  smaLabel?: string;
  emaLabel?: string;
  
  // Formatting
  metricFormatter: (value: number, adjusted?: boolean) => string;
  chartFormatter?: (value: number, adjusted?: boolean) => string;
  
  // Metric calculation
  getLatestValue: (data: T[]) => number;
  getMetricChange: (data: T[]) => number;
  getChangeLabel: () => string;
  getVariant: (latestValue: number, change: number) => "default" | "success" | "warning" | "danger";
  
  // Optional data transformation for inflation adjustment
  adjustDataForInflation?: (data: T[], cpiData: Array<{ date: string; value: number }>) => T[];
  
  // Optional additional modal actions
  additionalActions?: React.ReactNode;
  
  // Optional footer content in detailed view
  detailedFooter?: React.ReactNode;
  
  // Sidebar title
  sidebarTitle: string;
}

/**
 * Generic Macro Metric Card Component
 * Consolidates common logic for macro metric cards (liquidity, debt, real rates, etc.)
 */
export function MacroMetricCard<T extends MacroDataPoint>(config: MacroMetricCardConfig<T>) {
  const {
    id,
    title,
    subtitle,
    data,
    isLoading,
    error,
    valueKey,
    adjustmentData,
    chartColor,
    seriesType = "Line",
    chartHeight = 400,
    timeframe,
    setTimeframe,
    showSMA = false,
    showEMA = false,
    logScale = false,
    adjustForInflation = false,
    setPrefs,
    smaWindow = 20,
    emaWindow = 20,
    smaLabel,
    emaLabel,
    metricFormatter,
    chartFormatter,
    getLatestValue,
    getMetricChange,
    getChangeLabel,
    getVariant,
    adjustDataForInflation,
    additionalActions,
    detailedFooter,
    sidebarTitle,
  } = config;

  // Process chart data
  const chartData = React.useMemo(() => {
    if (!data) return [];

    // Apply inflation adjustment if configured
    if (adjustForInflation && adjustDataForInflation && adjustmentData && adjustmentData.length > 0) {
      return adjustDataForInflation(data, adjustmentData);
    }

    return data;
  }, [data, adjustForInflation, adjustDataForInflation, adjustmentData]);

  // Transform data for sparkline
  const sparklineData = React.useMemo((): ChartDataPoint[] => {
    return transformToLineDataWithKey(chartData, valueKey as string);
  }, [chartData, valueKey]);

  // Filtered and processed data for detailed view
  const detailedData = React.useMemo(() => {
    const filtered = filterByTimeframe(chartData, timeframe);

    // Calculate indicators on filtered data
    const values = filtered.map(d => Number(d[valueKey]));
    const sma = showSMA || showEMA ? calculateSMA(values, smaWindow) : [];
    const ema = showEMA ? calculateEMA(values, emaWindow) : [];

    return filtered.map((d, i) => ({
      ...d,
      sma: sma[i],
      ema: ema[i]
    }));
  }, [chartData, timeframe, valueKey, showSMA, showEMA, smaWindow, emaWindow]);

  // Transform detailed data for chart
  const detailedChartData = React.useMemo((): ChartDataPoint[] => {
    return transformToLineDataWithKey(detailedData, valueKey as string);
  }, [detailedData, valueKey]);

  // Create indicator series
  const extraSeries = React.useMemo((): ExtraSeriesConfig[] => {
    return createIndicatorSeries(detailedData, {
      showSMA,
      showEMA,
      smaLabel: smaLabel || `SMA ${smaWindow}`,
      emaLabel: emaLabel || `EMA ${emaWindow}`,
    });
  }, [detailedData, showSMA, showEMA, smaLabel, emaLabel, smaWindow, emaWindow]);

  // Price format for chart
  const priceFormat = React.useMemo(() => {
    if (chartFormatter) {
      return {
        formatter: (price: number) => chartFormatter(price, adjustForInflation)
      };
    }
    return { type: 'price' as const, precision: 2, minMove: 0.01 };
  }, [chartFormatter, adjustForInflation]);

  // Calculate stats for sidebar
  const stats = React.useMemo(() => {
    const values = detailedData.map(d => Number(d[valueKey]));
    return getFinancialStats(values);
  }, [detailedData, valueKey]);

  // Get latest values
  const latestValue = chartData.length > 0 ? getLatestValue(chartData) : 0;
  const metricChange = chartData.length > 0 ? getMetricChange(chartData) : 0;
  const variant = getVariant(latestValue, metricChange);

  // Error state
  if (error) {
    return (
      <DashboardCard className="p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">Failed to load {title.toLowerCase()}</span>
        </div>
      </DashboardCard>
    );
  }

  return (
    <ExpandableChartCard
      id={id}
      title={title}
      subtitle={subtitle}
      metricValue={metricFormatter(latestValue, adjustForInflation)}
      metricChange={metricChange}
      changeLabel={getChangeLabel()}
      variant={variant}
      isLoading={isLoading}
      condensedChart={
        <SparklineChart
          data={sparklineData}
          color={chartColor}
          height={80}
        />
      }
      detailedChart={
        <div className="space-y-2">
          <LightweightChart
            data={detailedChartData}
            seriesType={seriesType}
            colors={
              seriesType === "Area"
                ? {
                    lineColor: chartColor,
                    topColor: `${chartColor}66`, // 40% opacity
                    bottomColor: `${chartColor}00`, // 0% opacity
                  }
                : {
                    lineColor: chartColor,
                  }
            }
            extraSeries={extraSeries}
            logScale={logScale}
            height={chartHeight}
            fitContent
            priceFormat={priceFormat}
          />
          {detailedFooter}
        </div>
      }
      modalActions={
        <div className="flex items-center gap-4">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
          <div className="h-6 w-px bg-border/50" />
          {(showSMA !== undefined || showEMA !== undefined) && (
            <>
              {showSMA !== undefined && (
                <IndicatorToggle
                  label={smaLabel || `SMA ${smaWindow}`}
                  checked={showSMA}
                  onChange={(v) => setPrefs({ showSMA: v })}
                  color="#fbbf24"
                />
              )}
              {showEMA !== undefined && (
                <IndicatorToggle
                  label={emaLabel || `EMA ${emaWindow}`}
                  checked={showEMA}
                  onChange={(v) => setPrefs({ showEMA: v })}
                  color="#8b5cf6"
                />
              )}
              <div className="h-6 w-px bg-border/50" />
            </>
          )}
          <LogScaleToggle checked={logScale} onChange={(v) => setPrefs({ logScale: v })} />
          {additionalActions}
        </div>
      }
      sidebarContent={
        <MetricSummarySidebar
          stats={stats}
          title={sidebarTitle}
          formatter={(v) => metricFormatter(v, adjustForInflation)}
        />
      }
    />
  );
}
