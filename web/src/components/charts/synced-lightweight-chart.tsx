"use client";

import * as React from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type DeepPartial,
  type ChartOptions,
  type LineStyleOptions,
  type SeriesOptionsCommon,
  type AreaStyleOptions,
  LineSeries,
  AreaSeries,
  type MouseEventParams,
  type LogicalRange,
} from "lightweight-charts";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import type { ChartDataPoint, ExtraSeriesConfig } from "@/lib/chart-utils";

// Shared context for chart synchronization
interface SyncedChartsContextValue {
  /** Current crosshair time from any chart */
  crosshairTime: Time | null;
  /** Update crosshair time from a chart */
  setCrosshairTime: (time: Time | null, sourceId: string) => void;
  /** Current visible logical range */
  visibleRange: LogicalRange | null;
  /** Update visible range from a chart */
  setVisibleRange: (range: LogicalRange | null, sourceId: string) => void;
  /** Register a chart for synchronization */
  registerChart: (id: string, chart: IChartApi) => void;
  /** Unregister a chart */
  unregisterChart: (id: string) => void;
  /** Source chart that initiated the sync event */
  sourceId: string | null;
}

const SyncedChartsContext = React.createContext<SyncedChartsContextValue | null>(null);

export function SyncedChartsProvider({ children }: { children: React.ReactNode }) {
  const [crosshairTime, setCrosshairTimeState] = React.useState<Time | null>(null);
  const [visibleRange, setVisibleRangeState] = React.useState<LogicalRange | null>(null);
  const [sourceId, setSourceId] = React.useState<string | null>(null);
  const chartsRef = React.useRef<Map<string, IChartApi>>(new Map());

  const setCrosshairTime = React.useCallback((time: Time | null, source: string) => {
    setSourceId(source);
    setCrosshairTimeState(time);
  }, []);

  const setVisibleRange = React.useCallback((range: LogicalRange | null, source: string) => {
    setSourceId(source);
    setVisibleRangeState(range);

    // Sync visible range to all other charts
    if (range) {
      chartsRef.current.forEach((chart, id) => {
        if (id !== source) {
          chart.timeScale().setVisibleLogicalRange(range);
        }
      });
    }
  }, []);

  const registerChart = React.useCallback((id: string, chart: IChartApi) => {
    chartsRef.current.set(id, chart);
  }, []);

  const unregisterChart = React.useCallback((id: string) => {
    chartsRef.current.delete(id);
  }, []);

  return (
    <SyncedChartsContext.Provider
      value={{
        crosshairTime,
        setCrosshairTime,
        visibleRange,
        setVisibleRange,
        registerChart,
        unregisterChart,
        sourceId,
      }}
    >
      {children}
    </SyncedChartsContext.Provider>
  );
}

export function useSyncedCharts() {
  const context = React.useContext(SyncedChartsContext);
  if (!context) {
    throw new Error("useSyncedCharts must be used within a SyncedChartsProvider");
  }
  return context;
}

export function useSyncedChartsSafe() {
  const context = React.useContext(SyncedChartsContext);
  return context; // Returns null if not in provider
}

// Theme-aware chart options
function getChartOptions(theme: string | undefined): DeepPartial<ChartOptions> {
  const isDark = theme === "dark";

  return {
    layout: {
      background: { color: "transparent" },
      textColor: isDark ? "#d4d4d8" : "#18181b",
      fontSize: 12,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
    grid: {
      vertLines: { color: isDark ? "#27272a" : "#f4f4f5" },
      horzLines: { color: isDark ? "#27272a" : "#f4f4f5" },
    },
    crosshair: {
      mode: 1,
      vertLine: {
        color: isDark ? "#71717a" : "#a1a1aa",
        width: 1,
        style: 2,
        labelBackgroundColor: isDark ? "#27272a" : "#f4f4f5",
      },
      horzLine: {
        color: isDark ? "#71717a" : "#a1a1aa",
        width: 1,
        style: 2,
        labelBackgroundColor: isDark ? "#27272a" : "#f4f4f5",
      },
    },
    rightPriceScale: {
      borderColor: isDark ? "#27272a" : "#e4e4e7",
      scaleMargins: { top: 0.1, bottom: 0.1 },
    },
    timeScale: {
      borderColor: isDark ? "#27272a" : "#e4e4e7",
      timeVisible: true,
      secondsVisible: false,
    },
    handleScale: {
      axisPressedMouseMove: { time: true, price: true },
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: true,
    },
  };
}

interface SyncedLightweightChartProps {
  /** Unique ID for this chart instance */
  id: string;
  /** Data for the chart */
  data: ChartDataPoint[];
  /** Series type */
  seriesType?: "Line" | "Area";
  /** Series color */
  color?: string;
  /** Area gradient colors */
  topColor?: string;
  bottomColor?: string;
  /** Enable logarithmic scale */
  logScale?: boolean;
  /** Chart height */
  height?: number;
  /** Additional CSS class */
  className?: string;
  /** Extra series overlays */
  extraSeries?: ExtraSeriesConfig[];
  /** Chart title */
  title?: string;
  /** Enable time scale sync */
  syncTimeScale?: boolean;
  /** Enable crosshair sync */
  syncCrosshair?: boolean;
}

export function SyncedLightweightChart({
  id,
  data,
  seriesType = "Area",
  color = "#3b82f6",
  topColor,
  bottomColor,
  logScale = false,
  height = 200,
  className,
  extraSeries,
  title,
  syncTimeScale = true,
  syncCrosshair = true,
}: SyncedLightweightChartProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<IChartApi | null>(null);
  const mainSeriesRef = React.useRef<ISeriesApi<"Line" | "Area"> | null>(null);
  const extraSeriesRefs = React.useRef<ISeriesApi<"Line">[]>([]);
  const { resolvedTheme } = useTheme();

  // Safely get sync context - returns null if not available
  const syncContext = useSyncedChartsSafe();

  // Create chart (recreate when fundamental properties change)
  React.useEffect(() => {
    if (!containerRef.current) return;

    const isDark = resolvedTheme === "dark";
    const chart = createChart(containerRef.current, {
      ...getChartOptions(resolvedTheme),
      width: containerRef.current.clientWidth,
      height,
      rightPriceScale: {
        ...getChartOptions(resolvedTheme).rightPriceScale,
        mode: logScale ? 1 : 0,
      },
    });

    chartRef.current = chart;

    // Register with sync context
    if (syncContext) {
      syncContext.registerChart(id, chart);
    }

    // Create series
    const seriesOptions = {
      color,
      lineColor: color,
      topColor: topColor ?? (isDark ? `${color}40` : `${color}30`),
      bottomColor: bottomColor ?? "transparent",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title,
    };

    const series =
      seriesType === "Line"
        ? chart.addSeries(LineSeries, seriesOptions as DeepPartial<LineStyleOptions & SeriesOptionsCommon>)
        : chart.addSeries(AreaSeries, seriesOptions as DeepPartial<AreaStyleOptions & SeriesOptionsCommon>);

    mainSeriesRef.current = series;
    series.setData(data);

    // Add extra series
    if (extraSeries) {
      extraSeriesRefs.current = extraSeries.map((config) => {
        const extra = chart.addSeries(LineSeries, {
          color: config.color,
          lineWidth: config.lineWidth ?? 1,
          priceLineVisible: config.priceLineVisible ?? false,
          lastValueVisible: config.lastValueVisible ?? false,
          title: config.title,
        } as DeepPartial<LineStyleOptions & SeriesOptionsCommon>);
        extra.setData(config.data);
        return extra;
      });
    }

    chart.timeScale().fitContent();

    // Subscribe to crosshair for sync
    if (syncContext && syncCrosshair) {
      chart.subscribeCrosshairMove((param: MouseEventParams<Time>) => {
        const time = param.time ?? null;
        if (syncContext.sourceId !== id) {
          syncContext.setCrosshairTime(time, id);
        }
      });
    }

    // Subscribe to time scale changes for sync
    if (syncContext && syncTimeScale) {
      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range && syncContext.sourceId !== id) {
          syncContext.setVisibleRange(range, id);
        }
      });
    }

    return () => {
      if (syncContext) {
        syncContext.unregisterChart(id);
      }
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
      extraSeriesRefs.current = [];
    };
  }, [id, seriesType, resolvedTheme, height, logScale, syncContext, color, topColor, bottomColor, title, syncCrosshair, syncTimeScale, data, extraSeries]);

  // Update data when it changes
  React.useEffect(() => {
    if (!mainSeriesRef.current) return;
    mainSeriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  // Update extra series when they change
  React.useEffect(() => {
    if (!chartRef.current) return;
    
    // Remove existing extra series
    extraSeriesRefs.current.forEach(series => {
      chartRef.current!.removeSeries(series);
    });
    extraSeriesRefs.current = [];
    
    // Add new extra series
    if (extraSeries) {
      extraSeriesRefs.current = extraSeries.map((config) => {
        const extra = chartRef.current!.addSeries(LineSeries, {
          color: config.color,
          lineWidth: config.lineWidth ?? 1,
          priceLineVisible: config.priceLineVisible ?? false,
          lastValueVisible: config.lastValueVisible ?? false,
          title: config.title,
        } as DeepPartial<LineStyleOptions & SeriesOptionsCommon>);
        extra.setData(config.data);
        return extra;
      });
    }
  }, [extraSeries]);

  // Update theme
  React.useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions(getChartOptions(resolvedTheme));
  }, [resolvedTheme]);

  // Update data
  React.useEffect(() => {
    if (!mainSeriesRef.current) return;
    mainSeriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  // Update log scale
  React.useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.priceScale("right").applyOptions({
      mode: logScale ? 1 : 0,
    });
  }, [logScale]);

  // Handle resize
  React.useEffect(() => {
    if (!containerRef.current || !chartRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (chartRef.current && width > 0) {
          chartRef.current.applyOptions({ width });
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Update height
  React.useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({ height });
  }, [height]);

  return (
    <div ref={containerRef} className={cn("w-full", className)} style={{ height }} />
  );
}
