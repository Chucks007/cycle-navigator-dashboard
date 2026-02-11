/**
 * Unit tests for transformations/common
 *
 * Tests for the shared utility functions extracted from both
 * series-utils.ts and chart-utils.ts during REF-003.
 */
import { describe, it, expect } from 'vitest';
import { sortByDate, filterValidValues, filterValidOHLC } from '../common';

describe('sortByDate', () => {
    it('should sort by date ascending', () => {
        const data = [
            { date: '2024-01-03', value: 3 },
            { date: '2024-01-01', value: 1 },
            { date: '2024-01-02', value: 2 },
        ];

        const result = sortByDate(data);

        expect(result[0].date).toBe('2024-01-01');
        expect(result[1].date).toBe('2024-01-02');
        expect(result[2].date).toBe('2024-01-03');
    });

    it('should not mutate the original array', () => {
        const data = [
            { date: '2024-01-02', value: 2 },
            { date: '2024-01-01', value: 1 },
        ];

        const result = sortByDate(data);

        expect(data[0].date).toBe('2024-01-02');
        expect(result[0].date).toBe('2024-01-01');
    });

    it('should handle empty array', () => {
        expect(sortByDate([])).toEqual([]);
    });

    it('should handle Datetime field', () => {
        const data = [
            { Datetime: '2024-01-03', volume: 3 },
            { Datetime: '2024-01-01', volume: 1 },
        ];

        const result = sortByDate(data);

        expect(result[0].Datetime).toBe('2024-01-01');
        expect(result[1].Datetime).toBe('2024-01-03');
    });

    it('should handle numeric timestamps', () => {
        const data = [
            { date: 1704326400, value: 2 }, // 2024-01-04
            { date: 1704067200, value: 1 }, // 2024-01-01
        ];

        const result = sortByDate(data);

        expect(result[0].date).toBe(1704067200);
        expect(result[1].date).toBe(1704326400);
    });
});

describe('filterValidValues', () => {
    it('should keep finite values', () => {
        const data = [
            { date: '2024-01-01', value: 100 },
            { date: '2024-01-02', value: 0 },
            { date: '2024-01-03', value: -50 },
        ];

        const result = filterValidValues(data);

        expect(result).toHaveLength(3);
    });

    it('should filter out NaN', () => {
        const data = [
            { date: '2024-01-01', value: 100 },
            { date: '2024-01-02', value: NaN },
        ];

        const result = filterValidValues(data);

        expect(result).toHaveLength(1);
        expect(result[0].value).toBe(100);
    });

    it('should filter out Infinity', () => {
        const data = [
            { date: '2024-01-01', value: 100 },
            { date: '2024-01-02', value: Infinity },
            { date: '2024-01-03', value: -Infinity },
        ];

        const result = filterValidValues(data);

        expect(result).toHaveLength(1);
    });

    it('should filter out null and undefined treated as value', () => {
        const data = [
            { date: '2024-01-01', value: 100 },
            { date: '2024-01-02', value: null as unknown as number },
            { date: '2024-01-03', value: undefined as unknown as number },
        ];

        const result = filterValidValues(data);

        expect(result).toHaveLength(1);
        expect(result[0].value).toBe(100);
    });

    it('should handle empty array', () => {
        expect(filterValidValues([])).toEqual([]);
    });
});

describe('filterValidOHLC', () => {
    it('should keep items with all finite OHLC values', () => {
        const data = [
            { date: '2024-01-01', open: 100, high: 110, low: 95, close: 105 },
        ];

        const result = filterValidOHLC(data);

        expect(result).toHaveLength(1);
    });

    it('should filter out items with NaN in any OHLC field', () => {
        const data = [
            { date: '2024-01-01', open: 100, high: 110, low: 95, close: 105 },
            { date: '2024-01-02', open: NaN, high: 108, low: 102, close: 107 },
            { date: '2024-01-03', open: 100, high: Infinity, low: 95, close: 105 },
        ];

        const result = filterValidOHLC(data);

        expect(result).toHaveLength(1);
        expect(result[0].date).toBe('2024-01-01');
    });

    it('should handle capitalised field names (yfinance format)', () => {
        const data = [
            { Datetime: '2024-01-01', Open: 100, High: 110, Low: 95, Close: 105 },
            { Datetime: '2024-01-02', Open: NaN, High: 108, Low: 102, Close: 107 },
        ];

        const result = filterValidOHLC(data);

        expect(result).toHaveLength(1);
    });

    it('should handle empty array', () => {
        expect(filterValidOHLC([])).toEqual([]);
    });
});
