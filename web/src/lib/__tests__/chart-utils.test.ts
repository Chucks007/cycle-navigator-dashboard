/**
 * Unit tests for chart-utils.ts
 * Tests date parsing, data transformation, and edge case handling
 */
import { describe, it, expect } from 'vitest';
import {
  toChartTime,
  transformToLineData,
  transformToLineDataWithKey,
  transformToOHLCData,
  transformToHistogramData,
} from '../chart-utils';

describe('toChartTime', () => {
  describe('valid inputs', () => {
    it('should convert YYYY-MM-DD string to UTC timestamp', () => {
      const result = toChartTime('2024-01-15');
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('should handle timestamp in seconds', () => {
      const timestamp = 1609459200; // 2021-01-01 00:00:00 UTC
      const result = toChartTime(timestamp);
      expect(result).toBe(timestamp);
    });

    it('should handle timestamp in milliseconds', () => {
      const timestampMs = 1609459200000; // 2021-01-01 00:00:00 UTC in ms
      const result = toChartTime(timestampMs);
      expect(result).toBe(1609459200); // Should convert to seconds
    });

    it('should handle Date object', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = toChartTime(date);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('should convert ISO datetime string with midnight to UTC timestamp', () => {
      const result = toChartTime('2024-01-15T00:00:00Z');
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('should convert ISO datetime string with non-midnight time to UTC timestamp', () => {
      const result = toChartTime('2024-01-15T14:30:00Z');
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('invalid inputs', () => {
    it('should return null for empty string', () => {
      const result = toChartTime('');
      expect(result).toBeNull();
    });

    it('should return null for null', () => {
      const result = toChartTime(null as unknown as string | number | Date);
      expect(result).toBeNull();
    });

    it('should return null for undefined', () => {
      const result = toChartTime(undefined as unknown as string | number | Date);
      expect(result).toBeNull();
    });

    it('should return null for NaN', () => {
      const result = toChartTime(NaN);
      expect(result).toBeNull();
    });

    it('should return null for Infinity', () => {
      const result = toChartTime(Infinity);
      expect(result).toBeNull();
    });

    it('should return null for negative numbers', () => {
      const result = toChartTime(-1000);
      expect(result).toBeNull();
    });

    it('should return null for invalid date string', () => {
      const result = toChartTime('invalid-date');
      expect(result).toBeNull();
    });

    it('should return null for invalid Date object', () => {
      const result = toChartTime(new Date('invalid'));
      expect(result).toBeNull();
    });
  });
});

describe('transformToLineData', () => {
  it('should transform valid data correctly', () => {
    const data = [
      { date: '2024-01-01', value: 100 },
      { date: '2024-01-02', value: 105 },
      { date: '2024-01-03', value: 110 },
    ];

    const result = transformToLineData(data);
    
    expect(result).toHaveLength(3);
    expect(typeof result[0].time).toBe('number');
    expect(result[0].value).toBe(100);
    expect(typeof result[1].time).toBe('number');
    expect(result[1].value).toBe(105);
    expect(typeof result[2].time).toBe('number');
    expect(result[2].value).toBe(110);
  });

  it('should sort data by date ascending', () => {
    const data = [
      { date: '2024-01-03', value: 110 },
      { date: '2024-01-01', value: 100 },
      { date: '2024-01-02', value: 105 },
    ];

    const result = transformToLineData(data);
    
    // Verify sorting by comparing timestamps
    expect(result[0].value).toBe(100); // 2024-01-01
    expect(result[1].value).toBe(105); // 2024-01-02
    expect(result[2].value).toBe(110); // 2024-01-03
    expect(result[0].time).toBeLessThan(result[1].time as number);
    expect(result[1].time).toBeLessThan(result[2].time as number);
  });

  it('should filter out items with invalid dates', () => {
    const data = [
      { date: '2024-01-01', value: 100 },
      { date: '', value: 105 },
      { date: '2024-01-03', value: 110 },
      { date: null as unknown as string, value: 115 },
    ];

    const result = transformToLineData(data);
    
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(100);
    expect(result[1].value).toBe(110);
  });

  it('should filter out items with invalid values', () => {
    const data = [
      { date: '2024-01-01', value: 100 },
      { date: '2024-01-02', value: NaN },
      { date: '2024-01-03', value: 110 },
      { date: '2024-01-04', value: Infinity },
      { date: '2024-01-05', value: null as unknown as number },
    ];

    const result = transformToLineData(data);
    
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(100);
    expect(result[1].value).toBe(110);
  });

  it('should handle empty array', () => {
    const result = transformToLineData([]);
    expect(result).toHaveLength(0);
  });
});

describe('transformToLineDataWithKey', () => {
  it('should transform data with custom value key', () => {
    const data = [
      { date: '2024-01-01', price: 100, volume: 1000 },
      { date: '2024-01-02', price: 105, volume: 1500 },
    ];

    const result = transformToLineDataWithKey(data, 'price');
    
    expect(result).toHaveLength(2);
    expect(typeof result[0].time).toBe('number');
    expect(result[0].value).toBe(100);
    expect(typeof result[1].time).toBe('number');
    expect(result[1].value).toBe(105);
  });

  it('should filter out items with invalid values for the key', () => {
    const data = [
      { date: '2024-01-01', price: 100 },
      { date: '2024-01-02', price: NaN },
      { date: '2024-01-03', price: 110 },
    ];

    const result = transformToLineDataWithKey(data, 'price');
    
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(100);
    expect(result[1].value).toBe(110);
  });
});

describe('transformToOHLCData', () => {
  it('should transform standard OHLC format', () => {
    const data = [
      { date: '2024-01-01', open: 100, high: 105, low: 99, close: 103 },
      { date: '2024-01-02', open: 103, high: 108, low: 102, close: 107 },
    ];

    const result = transformToOHLCData(data);
    
    expect(result).toHaveLength(2);
    expect(typeof result[0].time).toBe('number');
    expect(result[0].open).toBe(100);
    expect(result[0].high).toBe(105);
    expect(result[0].low).toBe(99);
    expect(result[0].close).toBe(103);
  });

  it('should handle yfinance format (capitalized keys)', () => {
    const data = [
      { Datetime: '2024-01-01', Open: 100, High: 105, Low: 99, Close: 103 },
      { Datetime: '2024-01-02', Open: 103, High: 108, Low: 102, Close: 107 },
    ];

    const result = transformToOHLCData(data);
    
    expect(result).toHaveLength(2);
    expect(typeof result[0].time).toBe('number');
    expect(result[0].open).toBe(100);
    expect(result[0].high).toBe(105);
    expect(result[0].low).toBe(99);
    expect(result[0].close).toBe(103);
  });

  it('should filter out items with invalid dates', () => {
    const data = [
      { date: '2024-01-01', open: 100, high: 105, low: 99, close: 103 },
      { date: '', open: 103, high: 108, low: 102, close: 107 },
      { date: '2024-01-03', open: 107, high: 112, low: 106, close: 111 },
    ];

    const result = transformToOHLCData(data);
    
    expect(result).toHaveLength(2);
    expect(typeof result[0].time).toBe('number');
    expect(typeof result[1].time).toBe('number');
  });

  it('should filter out items with invalid OHLC values', () => {
    const data = [
      { date: '2024-01-01', open: 100, high: 105, low: 99, close: 103 },
      { date: '2024-01-02', open: NaN, high: 108, low: 102, close: 107 },
      { date: '2024-01-03', open: 107, high: Infinity, low: 106, close: 111 },
      { date: '2024-01-04', open: 111, high: 116, low: 110, close: 115 },
    ];

    const result = transformToOHLCData(data);
    
    expect(result).toHaveLength(2);
    expect(typeof result[0].time).toBe('number');
    expect(typeof result[1].time).toBe('number');
  });

  it('should sort data by date ascending', () => {
    const data = [
      { date: '2024-01-03', open: 107, high: 112, low: 106, close: 111 },
      { date: '2024-01-01', open: 100, high: 105, low: 99, close: 103 },
      { date: '2024-01-02', open: 103, high: 108, low: 102, close: 107 },
    ];

    const result = transformToOHLCData(data);
    
    expect(result[0].time).toBeLessThan(result[1].time as number);
    expect(result[1].time).toBeLessThan(result[2].time as number);
  });
});

describe('transformToHistogramData', () => {
  it('should transform histogram data correctly', () => {
    const data = [
      { date: '2024-01-01', volume: 1000 },
      { date: '2024-01-02', volume: 1500 },
    ];

    const result = transformToHistogramData(data, 'volume');
    
    expect(result).toHaveLength(2);
    expect(typeof result[0].time).toBe('number');
    expect(result[0].value).toBe(1000);
    expect(typeof result[1].time).toBe('number');
    expect(result[1].value).toBe(1500);
  });

  it('should handle Datetime field', () => {
    const data = [
      { Datetime: '2024-01-01', volume: 1000 },
      { Datetime: '2024-01-02', volume: 1500 },
    ];

    const result = transformToHistogramData(data, 'volume');
    
    expect(result).toHaveLength(2);
    expect(typeof result[0].time).toBe('number');
    expect(typeof result[1].time).toBe('number');
  });

  it('should apply color function when provided', () => {
    const data = [
      { date: '2024-01-01', volume: 1000, close: 100, open: 95 },
      { date: '2024-01-02', volume: 1500, close: 105, open: 110 },
    ];

    const colorFn = (item: typeof data[0]) => 
      item.close >= item.open ? '#22c55e' : '#ef4444';

    const result = transformToHistogramData(data, 'volume', colorFn);
    
    expect(result[0].color).toBe('#22c55e'); // close > open (bullish)
    expect(result[1].color).toBe('#ef4444'); // close < open (bearish)
  });

  it('should filter out items with invalid dates', () => {
    const data = [
      { date: '2024-01-01', volume: 1000 },
      { date: '', volume: 1500 },
      { date: '2024-01-03', volume: 2000 },
    ];

    const result = transformToHistogramData(data, 'volume');
    
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(1000);
    expect(result[1].value).toBe(2000);
  });

  it('should filter out items with invalid values', () => {
    const data = [
      { date: '2024-01-01', volume: 1000 },
      { date: '2024-01-02', volume: NaN },
      { date: '2024-01-03', volume: 2000 },
      { date: '2024-01-04', volume: Infinity },
    ];

    const result = transformToHistogramData(data, 'volume');
    
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(1000);
    expect(result[1].value).toBe(2000);
  });

  it('should sort data by date ascending', () => {
    const data = [
      { date: '2024-01-03', volume: 2000 },
      { date: '2024-01-01', volume: 1000 },
      { date: '2024-01-02', volume: 1500 },
    ];

    const result = transformToHistogramData(data, 'volume');
    
    expect(result[0].time).toBeLessThan(result[1].time as number);
    expect(result[1].time).toBeLessThan(result[2].time as number);
  });
});
