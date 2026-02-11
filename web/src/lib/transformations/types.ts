/**
 * Shared type definitions for time-series data transformations.
 *
 * Domain-level interfaces used across inflation adjustments, alignment,
 * and chart-adapter modules. Chart-library-specific types (e.g.,
 * Lightweight Charts `Time`) live in chart-adapters.ts instead.
 */

/**
 * A single data point in a time series (date string + numeric value).
 */
export interface SeriesPoint {
    date: string;
    value: number;
}

/**
 * OHLC data point with date string (for pre-chart transformation).
 */
export interface OHLCSeriesPoint {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
}
