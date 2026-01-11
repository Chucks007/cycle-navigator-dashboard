"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getLiquidity,
  getDebtStatus,
  getRealRates,
  getStockMetrics,
  getStockHistory,
  getStockIndicators,
  getSentiment,
} from "@/lib/api-client";
import {
  type LiquidityPoint,
  type DebtPoint,
  type RealRatePoint,
  type StockMetrics,
  type StockHistoryPoint,
  type StockIndicatorsPoint,
  type SentimentResponse,
} from "@/types/api";

// ============================================
// Macro Hooks
// ============================================

export function useLiquidity() {
  return useQuery<LiquidityPoint[], Error>({
    queryKey: ["macro", "liquidity"],
    queryFn: getLiquidity,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useDebtStatus() {
  return useQuery<DebtPoint[], Error>({
    queryKey: ["macro", "debt-status"],
    queryFn: getDebtStatus,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRealRates() {
  return useQuery<RealRatePoint[], Error>({
    queryKey: ["macro", "real-rates"],
    queryFn: getRealRates,
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
    queryFn: () => getStockMetrics(ticker, period, interval),
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
    queryFn: () => getStockHistory(ticker, period, interval),
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
    queryFn: () => getStockIndicators(ticker, period, interval),
    enabled: !!ticker,
  });
}

export function useSentiment(ticker: string) {
  return useQuery<SentimentResponse, Error>({
    queryKey: ["sentiment", ticker],
    queryFn: () => getSentiment(ticker),
    enabled: !!ticker,
  });
}
