"use client";

import * as React from "react";
import {
  adjustSeriesByM2,
  adjustSeriesByCPI,
  type SeriesPoint,
} from "@/lib/series-utils";
import type { PurchasingPowerMode } from "@/types/chart-preferences";

/**
 * Result from the inflation adjustment hook.
 */
export interface AdjustedDataResult {
  /** The (possibly adjusted) line data points */
  adjustedLineData: SeriesPoint[];
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
 *
 * @param priceSeries - The asset price data as SeriesPoint[] (date + value)
 * @param mode - The purchasing power mode (NOMINAL, REAL_M2, REAL_CPI)
 * @param m2Data - M2 supply data (only needed when mode === REAL_M2)
 * @param cpiData - CPI data (only needed when mode === REAL_CPI)
 * @param m2Loading - Whether M2 data is still loading
 * @param cpiLoading - Whether CPI data is still loading
 * @returns AdjustedDataResult with the transformed series and metadata
 *
 * @example
 * ```tsx
 * const priceSeries = history.map(p => ({ date: p.Datetime, value: p.Close }));
 * const { adjustedLineData, adjustmentLabel, isIndexed } = useInflationAdjustedData(
 *   priceSeries, purchasingPowerMode, m2Data, cpiData, m2Loading, cpiLoading
 * );
 * ```
 */
export function useInflationAdjustedData(
  priceSeries: SeriesPoint[],
  mode: PurchasingPowerMode,
  m2Data: SeriesPoint[] | null | undefined,
  cpiData: SeriesPoint[] | null | undefined,
  m2Loading: boolean = false,
  cpiLoading: boolean = false
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

  return { adjustedLineData, isAdjusting, adjustmentLabel, isIndexed };
}
