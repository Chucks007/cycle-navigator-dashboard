import type { Time, UTCTimestamp, BusinessDay } from "lightweight-charts";

/**
 * Data point format for Lightweight Charts line/area series
 */
export interface ChartDataPoint {
  time: Time;
  value: number;
}

/**
 * OHLC data point format for Lightweight Charts candlestick/bar series
 */
export interface OHLCDataPoint {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Histogram data point format
 */
export interface HistogramDataPoint {
  time: Time;
  value: number;
  color?: string;
}

/**
 * Extra series configuration for overlay lines (e.g., regression bands)
 */
export interface ExtraSeriesConfig {
  data: ChartDataPoint[];
  color: string;
  lineWidth?: number;
  priceLineVisible?: boolean;
  lastValueVisible?: boolean;
  title?: string;
  /** Line style: 0 = Solid, 1 = Dotted, 2 = Dashed, 3 = LargeDashed, 4 = SparseDotted */
  lineStyle?: number;
  /** Series type for the overlay */
  seriesType?: "Line" | "Area";
  /** Optional topColor for Area series */
  topColor?: string;
  /** Optional bottomColor for Area series */
  bottomColor?: string;
}

/**
 * Convert ISO date string (YYYY-MM-DD) or timestamp to Lightweight Charts Time format
 * Lightweight Charts accepts: 'YYYY-MM-DD' string, Unix timestamp (seconds), or BusinessDay object
 */
export function toChartTime(dateInput: string | number | Date): Time {
  if (typeof dateInput === "number") {
    // If it's a timestamp in milliseconds (> year 2000 in seconds), convert to seconds
    if (dateInput > 1e12) {
      return Math.floor(dateInput / 1000) as UTCTimestamp;
    }
    return dateInput as UTCTimestamp;
  }

  if (dateInput instanceof Date) {
    return Math.floor(dateInput.getTime() / 1000) as UTCTimestamp;
  }

  // String date - return as-is if it's YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput as Time;
  }

  // Handle YYYY-MM-DD HH:MM:SS format
  if (typeof dateInput === "string" && (dateInput.includes(" ") || dateInput.includes("T"))) {
    const d = new Date(dateInput);
    if (!isNaN(d.getTime())) {
      // If midnight (00:00:00), treat as daily data (return YYYY-MM-DD to avoid weekend gaps)
      // We check the string parts to avoid timezone conversion issues
      const timePart = dateInput.split(/[ T]/)[1]; // Get time part after space or T
      if (timePart && (timePart === "00:00:00" || timePart.startsWith("00:00:00"))) {
        return dateInput.split(/[ T]/)[0] as Time;
      }
      return Math.floor(d.getTime() / 1000) as UTCTimestamp;
    }
  }

  // Parse ISO string and convert to YYYY-MM-DD (Fallback)
  const date = new Date(dateInput);
  return date.toISOString().split("T")[0] as Time;
}

/**
 * Transform API response data to Lightweight Charts format for line/area series
 * Ensures data is sorted by date ascending (library requirement)
 */
export function transformToLineData<
  T extends { date: string | number; value: number }
>(data: T[]): ChartDataPoint[] {
  return [...data]
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA - dateB;
    })
    .map((item) => ({
      time: toChartTime(item.date),
      value: item.value,
    }));
}

/**
 * Transform API response data with custom value key
 */
export function transformToLineDataWithKey<T extends { date: string | number }>(
  data: T[],
  valueKey: keyof T
): ChartDataPoint[] {
  return [...data]
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA - dateB;
    })
    .map((item) => ({
      time: toChartTime(item.date),
      value: Number(item[valueKey]),
    }));
}

/**
 * Transform OHLC data for candlestick series
 * Handles both standard OHLC format and yfinance-style format (Datetime, Open, High, Low, Close)
 */
export function transformToOHLCData<
  T extends {
    date?: string | number;
    Datetime?: string | number;
    open?: number;
    Open?: number;
    high?: number;
    High?: number;
    low?: number;
    Low?: number;
    close?: number;
    Close?: number;
  }
>(data: T[]): OHLCDataPoint[] {
  return [...data]
    .sort((a, b) => {
      const dateA = new Date(a.date ?? a.Datetime ?? 0).getTime();
      const dateB = new Date(b.date ?? b.Datetime ?? 0).getTime();
      return dateA - dateB;
    })
    .map((item) => ({
      time: toChartTime(item.date ?? item.Datetime ?? ""),
      open: item.open ?? item.Open ?? 0,
      high: item.high ?? item.High ?? 0,
      low: item.low ?? item.Low ?? 0,
      close: item.close ?? item.Close ?? 0,
    }));
}

/**
 * Transform data for histogram series (e.g., volume)
 */
export function transformToHistogramData<
  T extends { date?: string | number; Datetime?: string | number }
>(
  data: T[],
  valueKey: keyof T,
  colorFn?: (item: T) => string
): HistogramDataPoint[] {
  return [...data]
    .sort((a, b) => {
      const dateA = new Date(a.date ?? a.Datetime ?? 0).getTime();
      const dateB = new Date(b.date ?? b.Datetime ?? 0).getTime();
      return dateA - dateB;
    })
    .map((item) => ({
      time: toChartTime(item.date ?? item.Datetime ?? ""),
      value: Number(item[valueKey]),
      ...(colorFn ? { color: colorFn(item) } : {}),
    }));
}

/**
 * Generate logarithmic regression bands around a price series
 * Used for "Fair Value" or "Regression Bands" overlays
 */
export function generateLogBands(
  data: ChartDataPoint[],
  deviations: number[] = [1, 2]
): { bands: ChartDataPoint[][]; centerLine: ChartDataPoint[] } {
  if (data.length < 2) {
    return { bands: [], centerLine: [] };
  }

  // Calculate log regression
  const n = data.length;
  const logValues = data.map((d) => Math.log(d.value));
  const xValues = data.map((_, i) => i);

  // Linear regression on log values
  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = logValues.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((acc, x, i) => acc + x * logValues[i], 0);
  const sumX2 = xValues.reduce((acc, x) => acc + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate standard deviation of residuals
  const residuals = logValues.map((y, i) => y - (slope * i + intercept));
  const stdDev = Math.sqrt(
    residuals.reduce((acc, r) => acc + r * r, 0) / n
  );

  // Generate center line
  const centerLine: ChartDataPoint[] = data.map((d, i) => ({
    time: d.time,
    value: Math.exp(slope * i + intercept),
  }));

  // Generate bands for each deviation
  const bands: ChartDataPoint[][] = deviations.flatMap((dev) => [
    // Upper band
    data.map((d, i) => ({
      time: d.time,
      value: Math.exp(slope * i + intercept + dev * stdDev),
    })),
    // Lower band
    data.map((d, i) => ({
      time: d.time,
      value: Math.exp(slope * i + intercept - dev * stdDev),
    })),
  ]);

  return { bands, centerLine };
}

/**
 * Downsample data for sparklines to improve performance
 * Takes every nth point to reduce data to approximately targetPoints
 */
export function downsampleData<T>(data: T[], targetPoints: number = 50): T[] {
  if (data.length <= targetPoints) return data;
  const step = Math.ceil(data.length / targetPoints);
  return data.filter((_, i) => i % step === 0);
}

/**
 * Create indicator series (SMA/EMA) for chart overlays
 * 
 * @param data - Array of data points with date and optional sma/ema values
 * @param options - Configuration for which indicators to show
 * @returns Array of ExtraSeriesConfig for chart overlay
 */
export function createIndicatorSeries<T extends { date: string | number; sma?: number | null; ema?: number | null }>(
  data: T[],
  options: { showSMA?: boolean; showEMA?: boolean; smaLabel?: string; emaLabel?: string; smaColor?: string; emaColor?: string }
): ExtraSeriesConfig[] {
  const {
    showSMA = false,
    showEMA = false,
    smaLabel = "SMA 20",
    emaLabel = "EMA 20",
    smaColor = "#fbbf24",
    emaColor = "#8b5cf6"
  } = options;

  const series: ExtraSeriesConfig[] = [];

  if (showSMA) {
    const smaData = data
      .filter(d => d.sma != null)
      .map(d => ({
        time: toChartTime(d.date),
        value: d.sma as number
      }));
    if (smaData.length > 0) {
      series.push({
        data: smaData,
        color: smaColor,
        lineWidth: 1,
        title: smaLabel
      });
    }
  }

  if (showEMA) {
    const emaData = data
      .filter(d => d.ema != null)
      .map(d => ({
        time: toChartTime(d.date),
        value: d.ema as number
      }));
    if (emaData.length > 0) {
      series.push({
        data: emaData,
        color: emaColor,
        lineWidth: 1,
        title: emaLabel
      });
    }
  }

  return series;
}

/**
 * Transform risk band data from API into ExtraSeriesConfig format for chart overlay.
 * 
 * @param bands - Array of RiskBand objects from API
 * @param options - Configuration options for the series
 * @returns Array of ExtraSeriesConfig for use with LightweightChart
 */
export function transformRiskBandsToSeries(
  bands: Array<{
    level: number;
    name: string;
    color: string;
    std_multiplier: number;
    values: Array<{ date: string; value: number }>;
  }>,
  options?: {
    lineWidth?: number;
    showLabels?: boolean;
    opacity?: number;
  }
): ExtraSeriesConfig[] {
  const { lineWidth = 1, showLabels = true, opacity } = options ?? {};

  return bands.map((band) => {
    // Apply opacity if provided, otherwise keep original color
    // For non-center bands, we might want to reduce opacity slightly by default if not specified
    let finalColor = band.color;
    if (opacity !== undefined) {
      if (band.color.startsWith("#")) {
        const r = parseInt(band.color.slice(1, 3), 16);
        const g = parseInt(band.color.slice(3, 5), 16);
        const b = parseInt(band.color.slice(5, 7), 16);
        finalColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
      }
    }

    return {
      data: band.values
        .filter((v) => v.value != null && isFinite(v.value))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((v) => ({
          time: toChartTime(v.date),
          value: v.value,
        })),
      color: finalColor,
      lineWidth,
      priceLineVisible: false,
      lastValueVisible: false,
      title: showLabels ? band.name : undefined,
      // Custom properties for band styling
      // Solid for center (Fair Value), dashed for others
      lineStyle: band.std_multiplier === 0 ? 0 : 2, 
    };
  });
}

/**
 * Get the band name for a given risk score.
 * Useful for tooltips and hover states.
 */
export function getRiskBandName(riskScore: number): string {
  // Map risk score (0-1) to band names
  const bands = [
    { max: 0.083, name: "Fire Sale" },
    { max: 0.166, name: "Deep Value" },
    { max: 0.333, name: "Undervalued" },
    { max: 0.416, name: "Below Fair" },
    { max: 0.583, name: "Fair Value" },
    { max: 0.666, name: "Above Fair" },
    { max: 0.833, name: "Overvalued" },
    { max: 0.916, name: "Bubble Zone" },
    { max: 1.0, name: "Maximum Bubble" },
  ];

  for (const band of bands) {
    if (riskScore <= band.max) {
      return band.name;
    }
  }
  return "Maximum Bubble";
}

/**
 * Get the color for a given risk score.
 * Returns a gradient from violet (low risk) to red (high risk).
 */
export function getRiskBandColor(riskScore: number): string {
  const colors = [
    "#7c3aed", // Violet - Fire Sale
    "#8b5cf6", // Purple - Deep Value
    "#3b82f6", // Blue - Undervalued
    "#06b6d4", // Cyan - Below Fair
    "#22c55e", // Green - Fair Value
    "#eab308", // Yellow - Above Fair
    "#f97316", // Orange - Overvalued
    "#ef4444", // Red - Bubble Zone
    "#dc2626", // Dark Red - Maximum Bubble
  ];

  const index = Math.min(Math.floor(riskScore * colors.length), colors.length - 1);
  return colors[index];
}
