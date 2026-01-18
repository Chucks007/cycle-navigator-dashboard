"use client";

import * as React from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type Time,
  type DeepPartial,
  type ChartOptions,
  type LineStyleOptions,
  type SeriesOptionsCommon,
  type AreaStyleOptions,
  type CandlestickStyleOptions,
  type HistogramStyleOptions,
  LineSeries,
  AreaSeries,
  CandlestickSeries,
  HistogramSeries,
  type MouseEventParams,
  type LogicalRange,
} from "lightweight-charts";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import type { ChartDataPoint, OHLCDataPoint, HistogramDataPoint, ExtraSeriesConfig } from "@/lib/chart-utils";

export type SeriesTypeOption = "Line" | "Area" | "Candlestick" | "Histogram";

interface ChartColors {
  lineColor?: string;
  topColor?: string;
  bottomColor?: string;
  upColor?: string;
  downColor?: string;
  wickUpColor?: string;
  wickDownColor?: string;
  borderUpColor?: string;
  borderDownColor?: string;
}

interface LegendData {
  date: string;
  value: string;
  percentChange?: string;
  color?: string;
}

interface LightweightChartProps {
  /** Data for line/area/histogram series */
  data?: ChartDataPoint[];
  /** Data for candlestick/bar series (OHLC) */
  ohlcData?: OHLCDataPoint[];
  /** Series type to render */
  seriesType?: SeriesTypeOption;
  /** Color overrides for the series */
  colors?: ChartColors;
  /** Enable auto-scaling */
  autoScale?: boolean;
  /** Enable logarithmic scale (critical for "Melt-Up" thesis) */
  logScale?: boolean;
  /** Price format options */
  priceFormat?: {
    type?: 'price' | 'volume' | 'percent' | 'custom';
    precision?: number;
    minMove?: number;
    formatter?: (price: number) => string;
  };
  /** Chart height in pixels */
  height?: number;
  /** Additional CSS class name */
  className?: string;
  /** Extra series to overlay (e.g., regression bands, moving averages) */
  extraSeries?: ExtraSeriesConfig[];
  /** Show price line */
  priceLineVisible?: boolean;
  /** Show last value label */
  lastValueVisible?: boolean;
  /** Crosshair move callback for chart synchronization */
  onCrosshairMove?: (time: Time | null, logicalRange: LogicalRange | null) => void;
  /** External crosshair time for synchronization */
  crosshairTime?: Time | null;
  /** Sync ID for chart synchronization context */
  syncId?: string;
  /** Show time scale */
  timeScaleVisible?: boolean;
  /** Show price scale */
  priceScaleVisible?: boolean;
  /** Fit content on load */
  fitContent?: boolean;
  /** Series title for tooltip */
  title?: string;
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
      mode: 0, // CrosshairMode.Magnet
      vertLine: {
        color: isDark ? "#71717a" : "#a1a1aa",
        width: 1,
        style: 2, // LineStyle.Dashed
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
      scaleMargins: {
        top: 0.1,
        bottom: 0.1,
      },
    },
    timeScale: {
      borderColor: isDark ? "#27272a" : "#e4e4e7",
      timeVisible: true,
      secondsVisible: false,
    },
    handleScale: {
      axisPressedMouseMove: {
        time: true,
        price: true,
      },
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: true,
    },
  };
}

// Default series colors based on theme
function getSeriesColors(theme: string | undefined, seriesType: SeriesTypeOption): ChartColors {
  const isDark = theme === "dark";
  
  switch (seriesType) {
    case "Line":
      return {
        lineColor: "#3b82f6", // Blue-500
      };
    case "Area":
      return {
        lineColor: "#3b82f6",
        topColor: isDark ? "rgba(59, 130, 246, 0.4)" : "rgba(59, 130, 246, 0.3)",
        bottomColor: isDark ? "rgba(59, 130, 246, 0.0)" : "rgba(59, 130, 246, 0.0)",
      };
    case "Candlestick":
      return {
        upColor: "#22c55e", // Green-500
        downColor: "#ef4444", // Red-500
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
      };
    case "Histogram":
      return {
        lineColor: isDark ? "rgba(59, 130, 246, 0.8)" : "rgba(59, 130, 246, 0.6)",
      };
    default:
      return {};
  }
}

export function LightweightChart({
  data,
  ohlcData,
  seriesType = "Line",
  colors,
  autoScale = true,
  logScale = false,
  height = 300,
  className,
  extraSeries,
  priceLineVisible = false,
  lastValueVisible = true,
  priceFormat,
  onCrosshairMove,
  crosshairTime,
  syncId,
  timeScaleVisible = true,
  priceScaleVisible = true,
  fitContent = true,
  title,
}: LightweightChartProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<IChartApi | null>(null);
  const mainSeriesRef = React.useRef<ISeriesApi<SeriesType> | null>(null);
  const extraSeriesRefs = React.useRef<ISeriesApi<"Line" | "Area">[]>([]);
  const { resolvedTheme } = useTheme();
  const [legendData, setLegendData] = React.useState<LegendData | null>(null);

  // Create chart and series
  React.useEffect(() => {
    if (!containerRef.current) return;

    // Create chart instance
    const chart = createChart(containerRef.current, {
      ...getChartOptions(resolvedTheme),
      width: containerRef.current.clientWidth,
      height,
      rightPriceScale: {
        ...getChartOptions(resolvedTheme).rightPriceScale,
        visible: priceScaleVisible,
        mode: logScale ? 1 : 0, // PriceScaleMode.Logarithmic = 1
        autoScale,
      },
      timeScale: {
        ...getChartOptions(resolvedTheme).timeScale,
        visible: timeScaleVisible,
      },
    });

    chartRef.current = chart;

    // Create main series based on type
    const seriesColors = { ...getSeriesColors(resolvedTheme, seriesType), ...colors };
    let series: ISeriesApi<SeriesType>;

    switch (seriesType) {
      case "Line":
        series = chart.addSeries(LineSeries, {
          color: seriesColors.lineColor,
          lineWidth: 2,
          priceLineVisible,
          lastValueVisible,
          title,
          priceFormat,
        } as DeepPartial<LineStyleOptions & SeriesOptionsCommon>);
        break;
      case "Area":
        series = chart.addSeries(AreaSeries, {
          lineColor: seriesColors.lineColor,
          topColor: seriesColors.topColor,
          bottomColor: seriesColors.bottomColor,
          lineWidth: 2,
          priceLineVisible,
          lastValueVisible,
          title,
          priceFormat,
        } as DeepPartial<AreaStyleOptions & SeriesOptionsCommon>);
        break;
      case "Candlestick":
        series = chart.addSeries(CandlestickSeries, {
          upColor: seriesColors.upColor,
          downColor: seriesColors.downColor,
          wickUpColor: seriesColors.wickUpColor,
          wickDownColor: seriesColors.wickDownColor,
          borderUpColor: seriesColors.borderUpColor,
          borderDownColor: seriesColors.borderDownColor,
          borderVisible: false,
          priceLineVisible,
          lastValueVisible,
          title,
          priceFormat,
        } as DeepPartial<CandlestickStyleOptions & SeriesOptionsCommon>);
        break;
      case "Histogram":
        series = chart.addSeries(HistogramSeries, {
          color: seriesColors.lineColor,
          priceLineVisible,
          lastValueVisible,
          title,
          priceFormat,
        } as DeepPartial<HistogramStyleOptions & SeriesOptionsCommon>);
        break;
      default:
        series = chart.addSeries(LineSeries, {
          color: seriesColors.lineColor,
          lineWidth: 2,
          priceLineVisible,
          lastValueVisible,
          title,
          priceFormat,
        } as DeepPartial<LineStyleOptions & SeriesOptionsCommon>);
    }

    mainSeriesRef.current = series;

    // Set data
    if (seriesType === "Candlestick" && ohlcData) {
      series.setData(ohlcData);
    } else if (data) {
      series.setData(data);
    }

    // Add extra series (overlays)
    if (extraSeries && extraSeries.length > 0) {
      extraSeriesRefs.current = extraSeries.map((config) => {
        let extraLine;
        if (config.seriesType === "Area") {
          extraLine = chart.addSeries(AreaSeries, {
            lineColor: config.color,
            topColor: config.topColor,
            bottomColor: config.bottomColor,
            lineWidth: config.lineWidth ?? 1,
            lineStyle: config.lineStyle ?? 0,
            priceLineVisible: config.priceLineVisible ?? false,
            lastValueVisible: config.lastValueVisible ?? false,
            title: config.title,
            priceFormat,
          } as DeepPartial<AreaStyleOptions & SeriesOptionsCommon>);
        } else {
          extraLine = chart.addSeries(LineSeries, {
            color: config.color,
            lineWidth: config.lineWidth ?? 1,
            lineStyle: config.lineStyle ?? 0, // 0=Solid, 2=Dashed
            priceLineVisible: config.priceLineVisible ?? false,
            lastValueVisible: config.lastValueVisible ?? false,
            title: config.title,
            priceFormat,
          } as DeepPartial<LineStyleOptions & SeriesOptionsCommon>);
        }
        extraLine.setData(config.data);
        return extraLine as ISeriesApi<"Line" | "Area">;
      });
    }

    // Fit content
    if (fitContent) {
      chart.timeScale().fitContent();
    }

    // Cleanup
    return () => {
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
      extraSeriesRefs.current = [];
    };
  }, [seriesType]); // Only recreate on series type change

  // Update theme
  React.useEffect(() => {
    if (!chartRef.current) return;

    const options = getChartOptions(resolvedTheme);
    chartRef.current.applyOptions(options);

    // Update series colors
    if (mainSeriesRef.current) {
      const seriesColors = { ...getSeriesColors(resolvedTheme, seriesType), ...colors };
      
      switch (seriesType) {
        case "Line":
          mainSeriesRef.current.applyOptions({
            color: seriesColors.lineColor,
          });
          break;
        case "Area":
          mainSeriesRef.current.applyOptions({
            lineColor: seriesColors.lineColor,
            topColor: seriesColors.topColor,
            bottomColor: seriesColors.bottomColor,
          });
          break;
        case "Candlestick":
          mainSeriesRef.current.applyOptions({
            upColor: seriesColors.upColor,
            downColor: seriesColors.downColor,
            wickUpColor: seriesColors.wickUpColor,
            wickDownColor: seriesColors.wickDownColor,
            borderUpColor: seriesColors.borderUpColor,
            borderDownColor: seriesColors.borderDownColor,
          });
          break;
        case "Histogram":
          mainSeriesRef.current.applyOptions({
            color: seriesColors.lineColor,
          });
          break;
      }
    }
  }, [resolvedTheme, colors, seriesType]);

  // Update data
  React.useEffect(() => {
    if (!mainSeriesRef.current) return;

    if (seriesType === "Candlestick" && ohlcData) {
      mainSeriesRef.current.setData(ohlcData);
    } else if (data) {
      mainSeriesRef.current.setData(data);
    }

    if (fitContent && chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data, ohlcData, seriesType, fitContent]);

  // Update extra series data
  React.useEffect(() => {
    if (!chartRef.current || !extraSeries) return;

    // Remove old extra series
    extraSeriesRefs.current.forEach((series) => {
      try {
        chartRef.current?.removeSeries(series);
      } catch {
        // Series might already be removed
      }
    });

    // Add new extra series
    extraSeriesRefs.current = extraSeries.map((config) => {
      const extraLine = chartRef.current!.addSeries(LineSeries, {
        color: config.color,
        lineWidth: config.lineWidth ?? 1,
        lineStyle: config.lineStyle ?? 0, // 0=Solid, 2=Dashed
        priceLineVisible: config.priceLineVisible ?? false,
        lastValueVisible: config.lastValueVisible ?? false,
        title: config.title,
      } as DeepPartial<LineStyleOptions & SeriesOptionsCommon>);
      extraLine.setData(config.data);
      return extraLine;
    });
  }, [extraSeries]);

  // Update log scale
  React.useEffect(() => {
    if (!chartRef.current) return;
    
    chartRef.current.priceScale("right").applyOptions({
      mode: logScale ? 1 : 0,
      autoScale,
    });
  }, [logScale, autoScale]);

  // Handle crosshair (Sync + Legend)
  React.useEffect(() => {
    if (!chartRef.current) return;

    const handleCrosshairMove = (param: MouseEventParams<Time>) => {
      // Sync
      if (onCrosshairMove) {
        const time = param.time ?? null;
        const logicalRange = chartRef.current?.timeScale().getVisibleLogicalRange() ?? null;
        onCrosshairMove(time, logicalRange);
      }

      // Legend
      if (param.time && mainSeriesRef.current && param.seriesData.size > 0) {
        const seriesData = param.seriesData.get(mainSeriesRef.current);
        let val: number | null = null;
        
        if (seriesData) {
            if ('value' in seriesData) val = (seriesData as any).value;
            else if ('close' in seriesData) val = (seriesData as any).close;
        }

        if (val !== null) {
          const sourceData = data || ohlcData || [];
          const idx = (sourceData as any[]).findIndex((d: any) => d.time === param.time);
          
          let pctStr = "";
          let color = undefined;

          if (idx > 0) {
             const prev = (sourceData as any[])[idx - 1];
             const prevVal = 'value' in prev ? prev.value : prev.close;
             if (prevVal !== 0) {
               const change = ((val - prevVal) / prevVal) * 100;
               pctStr = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
               color = change >= 0 ? "#22c55e" : "#ef4444";
             }
          }

          let valStr = val.toString();
          if (priceFormat?.formatter) {
             valStr = priceFormat.formatter(val);
          } else if (priceFormat?.precision !== undefined) {
             valStr = val.toFixed(priceFormat.precision);
          } else {
             valStr = val.toLocaleString(undefined, { maximumFractionDigits: 2 });
          }
          
          let dateStr = "";
          if (typeof param.time === 'string') {
            dateStr = param.time;
          } else if (typeof param.time === 'number') {
             dateStr = new Date(param.time * 1000).toISOString().split('T')[0];
          } else {
             const bd = param.time as { day: number; month: number; year: number };
             dateStr = `${bd.year}-${String(bd.month).padStart(2, '0')}-${String(bd.day).padStart(2, '0')}`;
          }

          setLegendData({
            date: dateStr,
            value: valStr,
            percentChange: pctStr,
            color
          });
          return;
        }
      }
      setLegendData(null);
    };

    chartRef.current.subscribeCrosshairMove(handleCrosshairMove);
    return () => {
        try {
           chartRef.current?.unsubscribeCrosshairMove(handleCrosshairMove);
        } catch(e) {}
    };
  }, [data, ohlcData, onCrosshairMove, priceFormat]);

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

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Update height
  React.useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({ height });
  }, [height]);

  // Handle external crosshair sync
  React.useEffect(() => {
    if (!chartRef.current || crosshairTime === undefined) return;

    if (crosshairTime) {
      // Move crosshair to the specified time
      // Note: This requires finding the logical index for the time
      // For now, we'll use setCrosshairPosition if available
    }
  }, [crosshairTime]);

  return (
    <div className="relative w-full">
      {legendData && (
        <div className="absolute top-2 left-2 z-10 bg-background/80 backdrop-blur-sm border rounded-md p-2 shadow-sm text-xs pointer-events-none transition-opacity duration-150">
          <div className="flex flex-col gap-0.5">
            <div className="text-muted-foreground font-mono">{legendData.date}</div>
            <div className="flex items-center gap-2">
              <span className="font-bold font-mono">{legendData.value}</span>
              {legendData.percentChange && (
                <span style={{ color: legendData.color }} className="font-mono">
                  {legendData.percentChange}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className={cn("w-full", className)}
        style={{ height }}
      />
    </div>
  );
}

// Sparkline variant - minimal chart for grid views
interface SparklineChartProps {
  data: ChartDataPoint[];
  color?: string;
  height?: number;
  className?: string;
}

export function SparklineChart({
  data,
  color = "#3b82f6",
  height = 60,
  className,
}: SparklineChartProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<IChartApi | null>(null);
  const { resolvedTheme } = useTheme();

  React.useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const isDark = resolvedTheme === "dark";

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { color: "transparent" },
        textColor: "transparent",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: {
        visible: false,
      },
      timeScale: {
        visible: false,
      },
      crosshair: {
        mode: 0, // Hidden
      },
      handleScale: false,
      handleScroll: false,
    });

    chartRef.current = chart;

    const series = chart.addSeries(AreaSeries, {
      lineColor: color,
      topColor: isDark ? `${color}40` : `${color}30`,
      bottomColor: isDark ? `${color}00` : `${color}00`,
      lineWidth: 2 as const,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    series.setData(data);
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [data, color, height, resolvedTheme]);

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

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("w-full", className)}
      style={{ height }}
    />
  );
}

// Export chart context for synchronization
interface ChartSyncContextValue {
  crosshairTime: Time | null;
  setCrosshairTime: (time: Time | null) => void;
  logicalRange: LogicalRange | null;
  setLogicalRange: (range: LogicalRange | null) => void;
}

const ChartSyncContext = React.createContext<ChartSyncContextValue | null>(null);

export function ChartSyncProvider({ children }: { children: React.ReactNode }) {
  const [crosshairTime, setCrosshairTime] = React.useState<Time | null>(null);
  const [logicalRange, setLogicalRange] = React.useState<LogicalRange | null>(null);

  return (
    <ChartSyncContext.Provider
      value={{ crosshairTime, setCrosshairTime, logicalRange, setLogicalRange }}
    >
      {children}
    </ChartSyncContext.Provider>
  );
}

export function useChartSync() {
  const context = React.useContext(ChartSyncContext);
  if (!context) {
    throw new Error("useChartSync must be used within a ChartSyncProvider");
  }
  return context;
}
