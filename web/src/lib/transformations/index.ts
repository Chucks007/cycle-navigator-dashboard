/**
 * Barrel export for `@/lib/transformations`.
 *
 * Re-exports every public symbol so consumers can import from a single path:
 *
 *   import { alignSeriesByDate, transformToLineData, type SeriesPoint } from '@/lib/transformations';
 */

// Domain types
export type { SeriesPoint, OHLCSeriesPoint } from "./types";

// Shared helpers
export { sortByDate, filterValidValues, filterValidOHLC } from "./common";

// Inflation / purchasing-power adjustments
export {
  alignSeriesByDate,
  indexSeriesToBase,
  adjustSeriesByM2,
  adjustSeriesByCPI,
  adjustOHLCByM2,
  adjustOHLCByCPI,
} from "./inflation";

// Chart adapters (Lightweight Charts formatting)
export {
  // Types
  type ChartDataPoint,
  type OHLCDataPoint,
  type HistogramDataPoint,
  type ExtraSeriesConfig,
  // Time conversion
  toChartTime,
  // Data transforms
  transformToLineData,
  transformToLineDataWithKey,
  transformToOHLCData,
  transformToHistogramData,
  // Chart helpers
  generateLogBands,
  downsampleData,
  createIndicatorSeries,
  transformRiskBandsToSeries,
  getRiskBandName,
  getRiskBandColor,
  // Macro overlays
  MACRO_OVERLAY_COLORS,
  formatLargeNumber,
  transformMacroSeriesToOverlay,
  transformMacroSeriesToOverlays,
} from "./chart-adapters";
