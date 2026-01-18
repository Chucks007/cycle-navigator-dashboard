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
