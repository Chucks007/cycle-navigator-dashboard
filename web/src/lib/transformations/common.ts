/**
 * Shared helpers for time-series data transformations.
 *
 * Consolidates the sorting-by-date and value-filtering patterns that were
 * previously duplicated across series-utils.ts and chart-utils.ts.
 */

/**
 * Sort an array of time-series points by date ascending.
 * Works with any object that has a `date` property (string or number).
 *
 * @returns A **new** sorted array (does not mutate the original).
 */
export function sortByDate<T extends { date?: string | number; Datetime?: string | number }>(
    data: T[]
): T[] {
    return [...data].sort((a, b) => {
        const dateA = new Date((a.date ?? a.Datetime ?? 0) as string | number).getTime();
        const dateB = new Date((b.date ?? b.Datetime ?? 0) as string | number).getTime();
        return dateA - dateB;
    });
}

/**
 * Filter out items whose `value` property is null, undefined, NaN, or ±Infinity.
 */
export function filterValidValues<T extends { value: number }>(data: T[]): T[] {
    return data.filter(
        (item) =>
            item.value !== null &&
            item.value !== undefined &&
            isFinite(item.value)
    );
}

/**
 * Filter out items with non-finite OHLC values.
 * Handles both lowercase (`open`) and capitalised (`Open`) field names
 * (the latter coming from yfinance-style APIs).
 */
export function filterValidOHLC<
    T extends {
        open?: number;
        Open?: number;
        high?: number;
        High?: number;
        low?: number;
        Low?: number;
        close?: number;
        Close?: number;
    }
>(data: T[]): T[] {
    return data.filter((item) => {
        const open = item.open ?? item.Open ?? 0;
        const high = item.high ?? item.High ?? 0;
        const low = item.low ?? item.Low ?? 0;
        const close = item.close ?? item.Close ?? 0;
        return isFinite(open) && isFinite(high) && isFinite(low) && isFinite(close);
    });
}
