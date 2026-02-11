"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useInflationAdjustedData } from "@/hooks/use-inflation-adjusted-data";
import { useCpi, useM2Supply } from "@/hooks/use-macro-data";
import {
  type StockFundamentals,
  type StockHistoryPoint,
  type StockIndicatorsPoint,
  type StockMetrics,
} from "@/types/api";
import type { PurchasingPowerMode } from "@/types/chart-preferences";
import type { OHLCSeriesPoint, SeriesPoint } from "@/lib/transformations";

// ============================================
// Stock Hooks
// ============================================

export function useStockMetrics(
  ticker: string,
  period: string = "1d",
  interval: string = "1m"
) {
  return useQuery<StockMetrics, Error>({
    queryKey: ["stock", "metrics", ticker, period, interval],
    queryFn: () => apiClient.getStockMetrics(ticker, period, interval),
    enabled: !!ticker,
  });
}

export function useStockHistory(
  ticker: string,
  period: string = "1d",
  interval: string = "1m"
) {
  return useQuery<StockHistoryPoint[], Error>({
    queryKey: ["stock", "history", ticker, period, interval],
    queryFn: () => apiClient.getStockHistory(ticker, period, interval),
    enabled: !!ticker,
  });
}

export function useStockIndicators(
  ticker: string,
  period: string = "1d",
  interval: string = "1m"
) {
  return useQuery<StockIndicatorsPoint[], Error>({
    queryKey: ["stock", "indicators", ticker, period, interval],
    queryFn: () => apiClient.getStockIndicators(ticker, period, interval),
    enabled: !!ticker,
  });
}

export function useStockFundamentals(ticker: string) {
  return useQuery<StockFundamentals, Error>({
    queryKey: ["stock", "fundamentals", ticker],
    queryFn: () => apiClient.getStockFundamentals(ticker),
    enabled: !!ticker,
    staleTime: 15 * 60 * 1000,
  });
}

// ============================================
// Composite Hooks
// ============================================

interface UseStockHistoryWithPowerAdjustmentsArgs {
  ticker: string;
  period?: string;
  interval?: string;
  purchasingPowerMode: PurchasingPowerMode;
  days?: number;
}

export function useStockHistoryWithPurchasingPower({
  ticker,
  period = "1d",
  interval = "1m",
  purchasingPowerMode,
  days,
}: UseStockHistoryWithPowerAdjustmentsArgs) {
  const historyQuery = useStockHistory(ticker, period, interval);

  const { data: m2Data, isLoading: m2Loading } = useM2Supply(
    days,
    purchasingPowerMode === "REAL_M2"
  );

  const { data: cpiData, isLoading: cpiLoading } = useCpi(
    purchasingPowerMode === "REAL_CPI" ? days : undefined
  );

  const priceSeries = React.useMemo((): SeriesPoint[] => {
    if (!historyQuery.data) return [];
    return historyQuery.data
      .slice()
      .sort((a, b) => new Date(a.Datetime).getTime() - new Date(b.Datetime).getTime())
      .map((point) => ({
        date: point.Datetime,
        value: point.Close,
      }))
      .filter((point) => isFinite(point.value));
  }, [historyQuery.data]);

  const ohlcSeriesPoints = React.useMemo((): OHLCSeriesPoint[] => {
    if (!historyQuery.data) return [];
    return historyQuery.data
      .slice()
      .sort((a, b) => new Date(a.Datetime).getTime() - new Date(b.Datetime).getTime())
      .filter((point) =>
        isFinite(point.Open) &&
        isFinite(point.High) &&
        isFinite(point.Low) &&
        isFinite(point.Close)
      )
      .map((point) => ({
        date: point.Datetime,
        open: point.Open,
        high: point.High,
        low: point.Low,
        close: point.Close,
      }));
  }, [historyQuery.data]);

  const m2Series = React.useMemo(
    () => m2Data?.map((d) => ({ date: d.date, value: d.value })) ?? null,
    [m2Data]
  );

  const cpiSeries = React.useMemo(
    () => cpiData?.map((d) => ({ date: d.date, value: d.value })) ?? null,
    [cpiData]
  );

  const adjustment = useInflationAdjustedData(
    priceSeries,
    purchasingPowerMode,
    m2Series,
    cpiSeries,
    m2Loading,
    cpiLoading,
    ohlcSeriesPoints
  );

  return {
    ...historyQuery,
    priceSeries,
    ohlcSeriesPoints,
    m2Series,
    cpiSeries,
    m2Loading,
    cpiLoading,
    adjustedLineData: adjustment.adjustedLineData,
    adjustedOHLCData: adjustment.adjustedOHLCData,
    adjustmentLabel: adjustment.adjustmentLabel,
    isIndexed: adjustment.isIndexed,
    isAdjusting: adjustment.isAdjusting,
  };
}
