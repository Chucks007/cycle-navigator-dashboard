/**
 * Inflation / purchasing-power adjustment utilities.
 *
 * Contains domain logic for aligning time series, indexing to a base,
 * and adjusting prices by M2 money supply or CPI.
 * Moved from the former `series-utils.ts` as part of REF-003.
 */

import type { SeriesPoint, OHLCSeriesPoint } from "./types";
import { sortByDate } from "./common";

// ────────────────────────────────────────────────────────────
// Alignment
// ────────────────────────────────────────────────────────────

/**
 * Align two time series by date, forward-filling auxiliary series values
 * for each primary series date.
 *
 * This handles frequency mismatches (e.g., monthly M2/CPI vs daily stock data).
 * For each primary date, uses the most recent auxiliary value where aux.date <= primary.date.
 *
 * @param primarySeries - The series to align to (e.g., daily stock prices)
 * @param auxSeries - The auxiliary series to forward-fill (e.g., monthly M2 or CPI)
 * @param dropEarly - If true, drop primary points before first aux date; if false, use first aux value
 * @returns Array of aligned points with both primary and auxiliary values
 *
 * @example
 * const stocks = [{ date: '2024-01-01', value: 100 }, { date: '2024-01-02', value: 101 }];
 * const m2 = [{ date: '2024-01-01', value: 21000 }];
 * const aligned = alignSeriesByDate(stocks, m2);
 * // Result: [{ date: '2024-01-01', primaryValue: 100, auxValue: 21000 },
 * //          { date: '2024-01-02', primaryValue: 101, auxValue: 21000 }]
 */
export function alignSeriesByDate(
    primarySeries: SeriesPoint[],
    auxSeries: SeriesPoint[],
    dropEarly: boolean = true
): Array<{ date: string; primaryValue: number; auxValue: number }> {
    if (!primarySeries.length || !auxSeries.length) {
        return [];
    }

    // Sort both series by date ascending
    const sortedPrimary = sortByDate(primarySeries);
    const sortedAux = sortByDate(auxSeries);

    const result: Array<{ date: string; primaryValue: number; auxValue: number }> = [];
    let auxIndex = 0;
    const firstAuxDate = new Date(sortedAux[0].date).getTime();

    for (const primaryPoint of sortedPrimary) {
        const primaryDate = new Date(primaryPoint.date).getTime();

        // Handle points before first aux date
        if (primaryDate < firstAuxDate) {
            if (dropEarly) {
                continue; // Skip this primary point
            } else {
                // Use first aux value (backfill)
                result.push({
                    date: primaryPoint.date,
                    primaryValue: primaryPoint.value,
                    auxValue: sortedAux[0].value,
                });
                continue;
            }
        }

        // Forward-fill: find the most recent aux value <= primary date
        while (
            auxIndex < sortedAux.length - 1 &&
            new Date(sortedAux[auxIndex + 1].date).getTime() <= primaryDate
        ) {
            auxIndex++;
        }

        result.push({
            date: primaryPoint.date,
            primaryValue: primaryPoint.value,
            auxValue: sortedAux[auxIndex].value,
        });
    }

    return result;
}

// ────────────────────────────────────────────────────────────
// Indexing
// ────────────────────────────────────────────────────────────

/**
 * Index a time series to 100 at a specified base point for better readability.
 * Converts absolute values to relative indices (base = 100).
 *
 * @param series - The series to index
 * @param base - Base reference: 'first' (default), 'last', or a specific date string
 * @returns Series with values indexed to 100 at the base point
 *
 * @example
 * const data = [{ date: '2024-01-01', value: 50 }, { date: '2024-01-02', value: 75 }];
 * const indexed = indexSeriesToBase(data);
 * // Result: [{ date: '2024-01-01', value: 100 }, { date: '2024-01-02', value: 150 }]
 */
export function indexSeriesToBase(
    series: SeriesPoint[],
    base: "first" | "last" | string = "first"
): SeriesPoint[] {
    if (!series.length) {
        return [];
    }

    // Sort by date ascending
    const sortedSeries = sortByDate(series);

    // Find base value
    let baseValue: number;
    if (base === "first") {
        baseValue = sortedSeries[0].value;
    } else if (base === "last") {
        baseValue = sortedSeries[sortedSeries.length - 1].value;
    } else {
        // Specific date
        const basePoint = sortedSeries.find((p) => p.date === base);
        if (!basePoint) {
            console.warn(`Base date ${base} not found in series. Using first point.`);
            baseValue = sortedSeries[0].value;
        } else {
            baseValue = basePoint.value;
        }
    }

    // Prevent division by zero
    if (baseValue === 0) {
        console.warn("Base value is 0. Cannot index series. Returning original.");
        return sortedSeries;
    }

    // Index all values to base = 100
    return sortedSeries.map((point) => ({
        date: point.date,
        value: (point.value / baseValue) * 100,
    }));
}

// ────────────────────────────────────────────────────────────
// M2 / CPI adjustments (line series)
// ────────────────────────────────────────────────────────────

/**
 * Adjust a series by dividing by M2 money supply to show purchasing power.
 * Optionally index the result to 100 for readability.
 *
 * @param assetSeries - The asset price series to adjust
 * @param m2Series - The M2 money supply series
 * @param indexToBase - Whether to index result to 100 at first point (default: true)
 * @param dropEarly - Whether to drop asset points before first M2 date (default: true)
 * @returns Purchasing-power-adjusted series
 *
 * @example
 * const stocks = [{ date: '2024-01-01', value: 5000 }];
 * const m2 = [{ date: '2024-01-01', value: 21000 }]; // billions
 * const adjusted = adjustSeriesByM2(stocks, m2);
 * // Result: [{ date: '2024-01-01', value: 100 }] (indexed to first point = 100)
 */
export function adjustSeriesByM2(
    assetSeries: SeriesPoint[],
    m2Series: SeriesPoint[],
    indexToBase: boolean = true,
    dropEarly: boolean = true
): SeriesPoint[] {
    // Align asset series with M2 series
    const aligned = alignSeriesByDate(assetSeries, m2Series, dropEarly);

    // Calculate purchasing power: asset / M2
    const adjusted = aligned.map((point) => ({
        date: point.date,
        value: point.primaryValue / point.auxValue,
    }));

    // Optionally index to 100 for readability
    if (indexToBase) {
        return indexSeriesToBase(adjusted, "first");
    }

    return adjusted;
}

/**
 * Adjust a series by CPI (Consumer Price Index) to show real/inflation-adjusted values.
 * Similar to M2 adjustment but uses CPI for inflation adjustment.
 *
 * @param nominalSeries - The nominal value series to adjust
 * @param cpiSeries - The CPI series (index values)
 * @param indexToBase - Whether to index result to 100 at first point (default: true)
 * @param dropEarly - Whether to drop points before first CPI date (default: true)
 * @returns Inflation-adjusted series
 *
 * @example
 * const m2 = [{ date: '2024-01-01', value: 21000 }];
 * const cpi = [{ date: '2024-01-01', value: 310 }];
 * const realM2 = adjustSeriesByCPI(m2, cpi);
 * // Result shows M2 in real terms (inflation-adjusted)
 */
export function adjustSeriesByCPI(
    nominalSeries: SeriesPoint[],
    cpiSeries: SeriesPoint[],
    indexToBase: boolean = true,
    dropEarly: boolean = true
): SeriesPoint[] {
    // Align nominal series with CPI series
    const aligned = alignSeriesByDate(nominalSeries, cpiSeries, dropEarly);

    if (!aligned.length) {
        return [];
    }

    // Find base CPI (first CPI value in aligned data)
    const baseCPI = aligned[0].auxValue;

    // Calculate real values: nominal / (CPI / base_CPI)
    const adjusted = aligned.map((point) => ({
        date: point.date,
        value: point.primaryValue / (point.auxValue / baseCPI),
    }));

    // Optionally index to 100 for readability
    if (indexToBase) {
        return indexSeriesToBase(adjusted, "first");
    }

    return adjusted;
}

// ────────────────────────────────────────────────────────────
// OHLC adjustments
// ────────────────────────────────────────────────────────────

/**
 * Compute the aligned adjustment factor for each date in the primary series.
 * Returns a Map of { date → factor } where factor is the divisor for that date.
 *
 * For M2 mode: factor = auxValue (raw M2 value)
 * For CPI mode: factor = auxValue / baseCPI (normalized CPI)
 */
function computeAdjustmentFactors(
    dates: string[],
    auxSeries: SeriesPoint[],
    mode: "M2" | "CPI",
    dropEarly: boolean = false
): Map<string, number> {
    // Build a dummy primary series using close prices (we only need the date alignment)
    const dummyPrimary: SeriesPoint[] = dates.map((d) => ({ date: d, value: 1 }));
    const aligned = alignSeriesByDate(dummyPrimary, auxSeries, dropEarly);

    const factorMap = new Map<string, number>();

    if (mode === "CPI" && aligned.length > 0) {
        const baseCPI = aligned[0].auxValue;
        for (const point of aligned) {
            factorMap.set(point.date, point.auxValue / baseCPI);
        }
    } else {
        for (const point of aligned) {
            factorMap.set(point.date, point.auxValue);
        }
    }

    return factorMap;
}

/**
 * Adjust OHLC data by M2 money supply. Divides all four price values (O/H/L/C)
 * by the same M2 factor for each date, then indexes to 100.
 *
 * @param ohlcSeries - The OHLC price data to adjust
 * @param m2Series - The M2 money supply series
 * @param indexToBase - Whether to index result to 100 at first point (default: true)
 * @param dropEarly - Whether to drop points before first M2 date (default: false)
 * @returns Adjusted OHLC series
 */
export function adjustOHLCByM2(
    ohlcSeries: OHLCSeriesPoint[],
    m2Series: SeriesPoint[],
    indexToBase: boolean = true,
    dropEarly: boolean = false
): OHLCSeriesPoint[] {
    if (!ohlcSeries.length || !m2Series.length) return [];

    const sorted = sortByDate(ohlcSeries);

    const dates = sorted.map((d) => d.date);
    const factors = computeAdjustmentFactors(dates, m2Series, "M2", dropEarly);

    // Divide all OHLC values by the M2 factor
    const adjusted = sorted
        .filter((p) => factors.has(p.date))
        .map((p) => {
            const factor = factors.get(p.date)!;
            return {
                date: p.date,
                open: p.open / factor,
                high: p.high / factor,
                low: p.low / factor,
                close: p.close / factor,
            };
        });

    if (!indexToBase || adjusted.length === 0) return adjusted;

    // Index to 100 using the first close value as base
    const baseClose = adjusted[0].close;
    if (baseClose === 0) return adjusted;

    const scale = 100 / baseClose;
    return adjusted.map((p) => ({
        date: p.date,
        open: p.open * scale,
        high: p.high * scale,
        low: p.low * scale,
        close: p.close * scale,
    }));
}

/**
 * Adjust OHLC data by CPI (inflation). Divides all four price values (O/H/L/C)
 * by the normalized CPI factor for each date, then indexes to 100.
 *
 * @param ohlcSeries - The OHLC price data to adjust
 * @param cpiSeries - The CPI series
 * @param indexToBase - Whether to index result to 100 at first point (default: true)
 * @param dropEarly - Whether to drop points before first CPI date (default: false)
 * @returns Inflation-adjusted OHLC series
 */
export function adjustOHLCByCPI(
    ohlcSeries: OHLCSeriesPoint[],
    cpiSeries: SeriesPoint[],
    indexToBase: boolean = true,
    dropEarly: boolean = false
): OHLCSeriesPoint[] {
    if (!ohlcSeries.length || !cpiSeries.length) return [];

    const sorted = sortByDate(ohlcSeries);

    const dates = sorted.map((d) => d.date);
    const factors = computeAdjustmentFactors(dates, cpiSeries, "CPI", dropEarly);

    // Divide all OHLC values by the normalized CPI factor
    const adjusted = sorted
        .filter((p) => factors.has(p.date))
        .map((p) => {
            const factor = factors.get(p.date)!;
            return {
                date: p.date,
                open: p.open / factor,
                high: p.high / factor,
                low: p.low / factor,
                close: p.close / factor,
            };
        });

    if (!indexToBase || adjusted.length === 0) return adjusted;

    // Index to 100 using the first close value as base
    const baseClose = adjusted[0].close;
    if (baseClose === 0) return adjusted;

    const scale = 100 / baseClose;
    return adjusted.map((p) => ({
        date: p.date,
        open: p.open * scale,
        high: p.high * scale,
        low: p.low * scale,
        close: p.close * scale,
    }));
}
