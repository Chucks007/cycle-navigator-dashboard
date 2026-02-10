/**
 * Unit tests for series-utils
 * 
 * To run these tests, install vitest:
 *   npm install -D vitest @vitest/ui
 * 
 * Add to package.json scripts:
 *   "test": "vitest"
 * 
 * Run tests:
 *   npm test
 */

import { describe, it, expect } from 'vitest';
import {
    alignSeriesByDate,
    indexSeriesToBase,
    adjustSeriesByM2,
    adjustSeriesByCPI,
    adjustOHLCByM2,
    adjustOHLCByCPI,
    type SeriesPoint,
    type OHLCSeriesPoint,
} from '../series-utils';

describe('alignSeriesByDate', () => {
    it('should align daily data with monthly data using forward-fill', () => {
        const daily: SeriesPoint[] = [
            { date: '2024-01-01', value: 100 },
            { date: '2024-01-02', value: 101 },
            { date: '2024-01-15', value: 102 },
            { date: '2024-02-01', value: 103 },
            { date: '2024-02-02', value: 104 },
        ];
        const monthly: SeriesPoint[] = [
            { date: '2024-01-01', value: 21000 },
            { date: '2024-02-01', value: 21100 },
        ];

        const result = alignSeriesByDate(daily, monthly);

        expect(result).toHaveLength(5);
        expect(result[0]).toEqual({ date: '2024-01-01', primaryValue: 100, auxValue: 21000 });
        expect(result[1]).toEqual({ date: '2024-01-02', primaryValue: 101, auxValue: 21000 });
        expect(result[2]).toEqual({ date: '2024-01-15', primaryValue: 102, auxValue: 21000 });
        expect(result[3]).toEqual({ date: '2024-02-01', primaryValue: 103, auxValue: 21100 });
        expect(result[4]).toEqual({ date: '2024-02-02', primaryValue: 104, auxValue: 21100 });
    });

    it('should drop primary points before first aux date by default', () => {
        const primary: SeriesPoint[] = [
            { date: '2023-12-01', value: 99 },
            { date: '2024-01-01', value: 100 },
            { date: '2024-01-02', value: 101 },
        ];
        const aux: SeriesPoint[] = [
            { date: '2024-01-01', value: 21000 },
        ];

        const result = alignSeriesByDate(primary, aux, true);

        expect(result).toHaveLength(2);
        expect(result[0].date).toBe('2024-01-01');
        expect(result[1].date).toBe('2024-01-02');
    });

    it('should backfill early primary points when dropEarly=false', () => {
        const primary: SeriesPoint[] = [
            { date: '2023-12-01', value: 99 },
            { date: '2024-01-01', value: 100 },
        ];
        const aux: SeriesPoint[] = [
            { date: '2024-01-01', value: 21000 },
        ];

        const result = alignSeriesByDate(primary, aux, false);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ date: '2023-12-01', primaryValue: 99, auxValue: 21000 });
        expect(result[1]).toEqual({ date: '2024-01-01', primaryValue: 100, auxValue: 21000 });
    });

    it('should handle empty series', () => {
        const result1 = alignSeriesByDate([], [{ date: '2024-01-01', value: 100 }]);
        const result2 = alignSeriesByDate([{ date: '2024-01-01', value: 100 }], []);

        expect(result1).toEqual([]);
        expect(result2).toEqual([]);
    });

    it('should sort series by date before aligning', () => {
        const unsorted: SeriesPoint[] = [
            { date: '2024-01-15', value: 102 },
            { date: '2024-01-01', value: 100 },
            { date: '2024-01-02', value: 101 },
        ];
        const aux: SeriesPoint[] = [
            { date: '2024-01-01', value: 21000 },
        ];

        const result = alignSeriesByDate(unsorted, aux);

        expect(result).toHaveLength(3);
        expect(result[0].date).toBe('2024-01-01');
        expect(result[1].date).toBe('2024-01-02');
        expect(result[2].date).toBe('2024-01-15');
    });
});

describe('indexSeriesToBase', () => {
    it('should index series to 100 at first point', () => {
        const series: SeriesPoint[] = [
            { date: '2024-01-01', value: 50 },
            { date: '2024-01-02', value: 75 },
            { date: '2024-01-03', value: 100 },
        ];

        const result = indexSeriesToBase(series);

        expect(result).toHaveLength(3);
        expect(result[0].value).toBe(100);
        expect(result[1].value).toBe(150);
        expect(result[2].value).toBe(200);
    });

    it('should index series to 100 at last point', () => {
        const series: SeriesPoint[] = [
            { date: '2024-01-01', value: 50 },
            { date: '2024-01-02', value: 75 },
            { date: '2024-01-03', value: 100 },
        ];

        const result = indexSeriesToBase(series, 'last');

        expect(result).toHaveLength(3);
        expect(result[0].value).toBe(50);
        expect(result[1].value).toBe(75);
        expect(result[2].value).toBe(100);
    });

    it('should index series to 100 at specific date', () => {
        const series: SeriesPoint[] = [
            { date: '2024-01-01', value: 50 },
            { date: '2024-01-02', value: 100 },
            { date: '2024-01-03', value: 150 },
        ];

        const result = indexSeriesToBase(series, '2024-01-02');

        expect(result).toHaveLength(3);
        expect(result[0].value).toBe(50);
        expect(result[1].value).toBe(100);
        expect(result[2].value).toBe(150);
    });

    it('should handle missing base date gracefully', () => {
        const series: SeriesPoint[] = [
            { date: '2024-01-01', value: 50 },
            { date: '2024-01-02', value: 100 },
        ];

        const result = indexSeriesToBase(series, '2024-12-31');

        // Should fall back to first point
        expect(result[0].value).toBe(100);
        expect(result[1].value).toBe(200);
    });

    it('should handle zero base value', () => {
        const series: SeriesPoint[] = [
            { date: '2024-01-01', value: 0 },
            { date: '2024-01-02', value: 100 },
        ];

        const result = indexSeriesToBase(series);

        // Should return original when base is zero
        expect(result[0].value).toBe(0);
        expect(result[1].value).toBe(100);
    });

    it('should sort series before indexing', () => {
        const unsorted: SeriesPoint[] = [
            { date: '2024-01-03', value: 150 },
            { date: '2024-01-01', value: 50 },
            { date: '2024-01-02', value: 100 },
        ];

        const result = indexSeriesToBase(unsorted);

        expect(result[0].date).toBe('2024-01-01');
        expect(result[0].value).toBe(100);
    });
});

describe('adjustSeriesByM2', () => {
    it('should adjust asset series by M2 and index to 100', () => {
        const assets: SeriesPoint[] = [
            { date: '2024-01-01', value: 5000 },
            { date: '2024-01-02', value: 6000 },
        ];
        const m2: SeriesPoint[] = [
            { date: '2024-01-01', value: 20000 },
            { date: '2024-01-02', value: 21000 },
        ];

        const result = adjustSeriesByM2(assets, m2);

        expect(result).toHaveLength(2);
        // First point should be indexed to 100
        expect(result[0].value).toBe(100);
        // Second point calculation: (6000/21000) / (5000/20000) * 100 = approx 114.29
        expect(result[1].value).toBeCloseTo(114.29, 1);
    });

    it('should return raw ratios when indexToBase=false', () => {
        const assets: SeriesPoint[] = [
            { date: '2024-01-01', value: 5000 },
        ];
        const m2: SeriesPoint[] = [
            { date: '2024-01-01', value: 20000 },
        ];

        const result = adjustSeriesByM2(assets, m2, false);

        expect(result).toHaveLength(1);
        expect(result[0].value).toBe(5000 / 20000);
    });
});

describe('adjustSeriesByCPI', () => {
    it('should adjust nominal series by CPI and index to 100', () => {
        const nominal: SeriesPoint[] = [
            { date: '2024-01-01', value: 21000 },
            { date: '2024-02-01', value: 21500 },
        ];
        const cpi: SeriesPoint[] = [
            { date: '2024-01-01', value: 310 },
            { date: '2024-02-01', value: 315 },
        ];

        const result = adjustSeriesByCPI(nominal, cpi);

        expect(result).toHaveLength(2);
        // First point indexed to 100
        expect(result[0].value).toBe(100);
        // Second point: 21500 / (315/310) compared to base
        // = 21500 * (310/315) / 21000 * 100 ≈ 100.79
        expect(result[1].value).toBeCloseTo(100.79, 1);
    });

    it('should handle inflation adjustment correctly', () => {
        const nominal: SeriesPoint[] = [
            { date: '2024-01-01', value: 1000 },
            { date: '2024-01-02', value: 1000 }, // Same nominal
        ];
        const cpi: SeriesPoint[] = [
            { date: '2024-01-01', value: 100 },
            { date: '2024-01-02', value: 110 }, // 10% inflation
        ];

        const result = adjustSeriesByCPI(nominal, cpi);

        expect(result).toHaveLength(2);
        expect(result[0].value).toBe(100);
        // Real value should decrease with inflation
        expect(result[1].value).toBeLessThan(100);
        expect(result[1].value).toBeCloseTo(90.91, 1);
    });
});

// ============================================
// OHLC Adjustment Tests
// ============================================

describe('adjustOHLCByM2', () => {
    const ohlc: OHLCSeriesPoint[] = [
        { date: '2024-01-01', open: 100, high: 110, low: 95, close: 105 },
        { date: '2024-01-02', open: 105, high: 120, low: 100, close: 115 },
    ];
    const m2: SeriesPoint[] = [
        { date: '2024-01-01', value: 20000 },
        { date: '2024-01-02', value: 21000 },
    ];

    it('should adjust all four OHLC values by M2 and index to 100', () => {
        const result = adjustOHLCByM2(ohlc, m2);

        expect(result).toHaveLength(2);
        // First close is base → should be 100
        expect(result[0].close).toBe(100);
        // First open: (100/20000) / (105/20000) * 100 ≈ 95.24
        expect(result[0].open).toBeCloseTo(95.24, 1);
        // First high: (110/20000) / (105/20000) * 100 ≈ 104.76
        expect(result[0].high).toBeCloseTo(104.76, 1);
        // First low: (95/20000) / (105/20000) * 100 ≈ 90.48
        expect(result[0].low).toBeCloseTo(90.48, 1);
    });

    it('should preserve high >= max(open, close, low) after adjustment', () => {
        const result = adjustOHLCByM2(ohlc, m2);

        for (const point of result) {
            expect(point.high).toBeGreaterThanOrEqual(point.open);
            expect(point.high).toBeGreaterThanOrEqual(point.close);
            expect(point.high).toBeGreaterThanOrEqual(point.low);
        }
    });

    it('should preserve low <= min(open, close, high) after adjustment', () => {
        const result = adjustOHLCByM2(ohlc, m2);

        for (const point of result) {
            expect(point.low).toBeLessThanOrEqual(point.open);
            expect(point.low).toBeLessThanOrEqual(point.close);
            expect(point.low).toBeLessThanOrEqual(point.high);
        }
    });

    it('should handle empty inputs', () => {
        expect(adjustOHLCByM2([], m2)).toEqual([]);
        expect(adjustOHLCByM2(ohlc, [])).toEqual([]);
    });

    it('should return raw ratios when indexToBase=false', () => {
        const result = adjustOHLCByM2(ohlc, m2, false);

        expect(result).toHaveLength(2);
        expect(result[0].close).toBe(105 / 20000);
        expect(result[0].open).toBe(100 / 20000);
        expect(result[1].close).toBe(115 / 21000);
    });

    it('should forward-fill M2 for daily OHLC data with monthly M2', () => {
        const dailyOhlc: OHLCSeriesPoint[] = [
            { date: '2024-01-01', open: 100, high: 110, low: 95, close: 105 },
            { date: '2024-01-10', open: 106, high: 112, low: 102, close: 108 },
            { date: '2024-02-01', open: 110, high: 120, low: 105, close: 115 },
        ];
        const monthlyM2: SeriesPoint[] = [
            { date: '2024-01-01', value: 20000 },
            { date: '2024-02-01', value: 20500 },
        ];

        const result = adjustOHLCByM2(dailyOhlc, monthlyM2);

        expect(result).toHaveLength(3);
        // Jan 10 should use Jan 1 M2 value (forward-fill)
        // All values should be finite
        for (const point of result) {
            expect(isFinite(point.open)).toBe(true);
            expect(isFinite(point.high)).toBe(true);
            expect(isFinite(point.low)).toBe(true);
            expect(isFinite(point.close)).toBe(true);
        }
    });
});

describe('adjustOHLCByCPI', () => {
    const ohlc: OHLCSeriesPoint[] = [
        { date: '2024-01-01', open: 100, high: 110, low: 95, close: 105 },
        { date: '2024-02-01', open: 105, high: 120, low: 100, close: 115 },
    ];
    const cpi: SeriesPoint[] = [
        { date: '2024-01-01', value: 300 },
        { date: '2024-02-01', value: 310 },
    ];

    it('should adjust OHLC by CPI and index to 100', () => {
        const result = adjustOHLCByCPI(ohlc, cpi);

        expect(result).toHaveLength(2);
        // First close is base → 100
        expect(result[0].close).toBe(100);
        // All values should be finite
        for (const point of result) {
            expect(isFinite(point.open)).toBe(true);
            expect(isFinite(point.close)).toBe(true);
        }
    });

    it('should show inflation erosion: flat nominal + rising CPI = declining real', () => {
        const flatOhlc: OHLCSeriesPoint[] = [
            { date: '2024-01-01', open: 100, high: 105, low: 95, close: 100 },
            { date: '2024-02-01', open: 100, high: 105, low: 95, close: 100 },
        ];
        const risingCpi: SeriesPoint[] = [
            { date: '2024-01-01', value: 100 },
            { date: '2024-02-01', value: 110 }, // 10% inflation
        ];

        const result = adjustOHLCByCPI(flatOhlc, risingCpi);

        expect(result).toHaveLength(2);
        expect(result[0].close).toBe(100);
        // Real close should decline due to inflation
        expect(result[1].close).toBeLessThan(100);
        expect(result[1].close).toBeCloseTo(90.91, 1);
    });

    it('should preserve OHLC ordering after CPI adjustment', () => {
        const result = adjustOHLCByCPI(ohlc, cpi);

        for (const point of result) {
            expect(point.high).toBeGreaterThanOrEqual(point.open);
            expect(point.high).toBeGreaterThanOrEqual(point.close);
            expect(point.high).toBeGreaterThanOrEqual(point.low);
            expect(point.low).toBeLessThanOrEqual(point.open);
            expect(point.low).toBeLessThanOrEqual(point.close);
        }
    });

    it('should handle empty inputs', () => {
        expect(adjustOHLCByCPI([], cpi)).toEqual([]);
        expect(adjustOHLCByCPI(ohlc, [])).toEqual([]);
    });
});
