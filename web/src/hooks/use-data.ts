"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchLiquidity,
  fetchDebtStatus,
  fetchRealRates,
  fetchStockMetrics,
  fetchStockHistory,
  fetchStockIndicators,
  fetchSentiment,
  type LiquidityData,
  type DebtStatusData,
  type RealRatesData,
  type StockMetrics,
  type StockHistoryPoint,
  type StockIndicators,
  type SentimentData,
} from "@/lib/api";

// ============================================
// Macro Hooks
// ============================================

export function useLiquidity() {
  return useQuery<LiquidityData[], Error>({
    queryKey: ["macro", "liquidity"],
    queryFn: fetchLiquidity,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useDebtStatus() {
  return useQuery<DebtStatusData[], Error>({
    queryKey: ["macro", "debt-status"],
    queryFn: fetchDebtStatus,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRealRates() {
  return useQuery<RealRatesData[], Error>({
    queryKey: ["macro", "real-rates"],
    queryFn: fetchRealRates,
    staleTime: 5 * 60 * 1000,
  });
}

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
    queryFn: () => fetchStockMetrics(ticker, period, interval),
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
    queryFn: () => fetchStockHistory(ticker, period, interval),
    enabled: !!ticker,
  });
}

export function useStockIndicators(
  ticker: string,
  period: string = "1d",
  interval: string = "1m"
) {
  return useQuery<StockIndicators[], Error>({
    queryKey: ["stock", "indicators", ticker, period, interval],
    queryFn: () => fetchStockIndicators(ticker, period, interval),
    enabled: !!ticker,
  });
}

export function useSentiment(ticker: string) {
  return useQuery<SentimentData, Error>({
    queryKey: ["sentiment", ticker],
    queryFn: () => fetchSentiment(ticker),
    enabled: !!ticker,
  });
}
