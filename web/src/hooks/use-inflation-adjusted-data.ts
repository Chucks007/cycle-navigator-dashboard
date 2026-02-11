"use client";

import * as React from "react";
import {
  adjustSeriesByM2,
  adjustSeriesByCPI,
  adjustOHLCByM2,
  adjustOHLCByCPI,
  type SeriesPoint,
  type OHLCSeriesPoint,
} from "@/lib/transformations";
import type { PurchasingPowerMode } from "@/types/chart-preferences";

/**
 * Result from the inflation adjustment hook.
 */
export interface AdjustedDataResult {
  /** The (possibly adjusted) line data points */
  adjustedLineData: SeriesPoint[];
  /** The (possibly adjusted) OHLC data points */
  adjustedOHLCData: OHLCSeriesPoint[];
  /** Whether the data is currently being adjusted (auxiliary data loading) */
  isAdjusting: boolean;
  /** Label suffix for chart titles (e.g., " (M2 Adjusted)") */
  adjustmentLabel: string;
  /** Whether values represent an index (base 100) vs. dollar amounts */
  isIndexed: boolean;
}

/**
 * Hook that encapsulates purchasing power adjustment logic for any price series.
 *
 * Aligns the asset price series with M2 or CPI data, applies the division,
 * and indexes the result to 100 at the start of the visible timeframe.
 * Supports both line (close-only) and OHLC (candlestick) data.
 *
 * @param priceSeries - The asset price data as SeriesPoint[] (date + value)
 * @param mode - The purchasing power mode (NOMINAL, REAL_M2, REAL_CPI)
 * @param m2Data - M2 supply data (only needed when mode === REAL_M2)
 * @param cpiData - CPI data (only needed when mode === REAL_CPI)
 * @param m2Loading - Whether M2 data is still loading
 * @param cpiLoading - Whether CPI data is still loading
 * @param ohlcSeries - Optional OHLC data for candlestick adjustment
 * @returns AdjustedDataResult with the transformed series and metadata
 */
export function useInflationAdjustedData(
  priceSeries: SeriesPoint[],
  mode: PurchasingPowerMode,
  m2Data: SeriesPoint[] | null | undefined,
  cpiData: SeriesPoint[] | null | undefined,
  m2Loading: boolean = false,
  cpiLoading: boolean = false,
  ohlcSeries: OHLCSeriesPoint[] = []
): AdjustedDataResult {
  const adjustedLineData = React.useMemo((): SeriesPoint[] => {
    if (!priceSeries.length) return [];

    if (mode === "REAL_M2" && m2Data?.length) {
      return adjustSeriesByM2(priceSeries, m2Data, true, false);
    }

    if (mode === "REAL_CPI" && cpiData?.length) {
      return adjustSeriesByCPI(priceSeries, cpiData, true, false);
    }

    // NOMINAL mode or auxiliary data not yet available
    return priceSeries;
  }, [priceSeries, mode, m2Data, cpiData]);

  const adjustedOHLCData = React.useMemo((): OHLCSeriesPoint[] => {
    if (!ohlcSeries.length) return [];

    if (mode === "REAL_M2" && m2Data?.length) {
      return adjustOHLCByM2(ohlcSeries, m2Data, true, false);
    }

    if (mode === "REAL_CPI" && cpiData?.length) {
      return adjustOHLCByCPI(ohlcSeries, cpiData, true, false);
    }

    // NOMINAL mode or auxiliary data not yet available
    return ohlcSeries;
  }, [ohlcSeries, mode, m2Data, cpiData]);

  const isAdjusting =
    (mode === "REAL_M2" && m2Loading) || (mode === "REAL_CPI" && cpiLoading);

  const adjustmentLabel = React.useMemo(() => {
    switch (mode) {
      case "REAL_M2":
        return " (M2 Adjusted, Index)";
      case "REAL_CPI":
        return " (CPI Adjusted, Index)";
      default:
        return "";
    }
  }, [mode]);

  const isIndexed = mode !== "NOMINAL";

  return { adjustedLineData, adjustedOHLCData, isAdjusting, adjustmentLabel, isIndexed };
}
