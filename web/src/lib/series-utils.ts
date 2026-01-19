/**
 * Series utilities for M2 purchasing power adjustments
 * Provides alignment and indexing helpers for time-series data transformation
 */

export interface SeriesPoint {
    date: string;
    value: number;
}

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
    const sortedPrimary = [...primarySeries].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const sortedAux = [...auxSeries].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

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
    base: 'first' | 'last' | string = 'first'
): SeriesPoint[] {
    if (!series.length) {
        return [];
    }

    // Sort by date ascending
    const sortedSeries = [...series].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Find base value
    let baseValue: number;
    if (base === 'first') {
        baseValue = sortedSeries[0].value;
    } else if (base === 'last') {
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
        console.warn('Base value is 0. Cannot index series. Returning original.');
        return sortedSeries;
    }

    // Index all values to base = 100
    return sortedSeries.map((point) => ({
        date: point.date,
        value: (point.value / baseValue) * 100,
    }));
}

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
        return indexSeriesToBase(adjusted, 'first');
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
        return indexSeriesToBase(adjusted, 'first');
    }

    return adjusted;
}
