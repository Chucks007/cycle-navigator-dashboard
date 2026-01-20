"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  type LiquidityPoint,
  type DebtPoint,
  type RealRatePoint,
  type CPIPoint,
  type CryptoDominanceResponse,
  type StockMetrics,
  type StockHistoryPoint,
  type StockIndicatorsPoint,
  type SentimentResponse,
  type RiskResponse,
  type RiskScoreResponse,
} from "@/types/api";

// ============================================
// Macro Hooks
// ============================================

export function useLiquidity(days?: number) {
  return useQuery<LiquidityPoint[], Error>({
    queryKey: ["macro", "liquidity", days],
    queryFn: () => apiClient.getLiquidity(days),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useDebtStatus(days?: number) {
  return useQuery<DebtPoint[], Error>({
    queryKey: ["macro", "debt-status", days],
    queryFn: () => apiClient.getDebtStatus(days),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRealRates() {
  return useQuery<RealRatePoint[], Error>({
    queryKey: ["macro", "real-rates"],
    queryFn: () => apiClient.getRealRates(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCpi(days?: number) {
  return useQuery<CPIPoint[], Error>({
    queryKey: ["macro", "cpi", days],
    queryFn: () => apiClient.getCpi(days),
    staleTime: 5 * 60 * 1000,
    enabled: days !== undefined, // Only fetch when explicitly requested
  });
}

// ============================================
// Crypto Hooks
// ============================================

export function useCryptoDominance(days: number = 365) {
  return useQuery<CryptoDominanceResponse, Error>({
    queryKey: ["crypto", "dominance", days],
    queryFn: () => apiClient.getCryptoDominance(days),
    staleTime: 5 * 60 * 1000, // 5 minutes
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

export function useSentiment(ticker: string) {
  return useQuery<SentimentResponse, Error>({
    queryKey: ["sentiment", ticker],
    queryFn: () => apiClient.getSentiment(ticker),
    enabled: !!ticker,
  });
}

// ============================================
// Risk / Regression Bands Hooks
// ============================================

/**
 * Fetch full risk data including regression bands for charting.
 * Best for: Charts with band overlays, detailed risk analysis
 * Supported tickers: BTC, ETH
 */
export function useRiskData(ticker: string, enabled: boolean = true) {
  return useQuery<RiskResponse, Error>({
    queryKey: ["risk", "full", ticker],
    queryFn: () => apiClient.getRiskData(ticker),
    enabled: !!ticker && enabled,
    staleTime: 30 * 60 * 1000, // 30 minutes - bands don't change often
    gcTime: 60 * 60 * 1000, // 1 hour cache
  });
}

/**
 * Fetch lightweight risk score data (faster, no band details).
 * Best for: Dashboard cards, risk gauges, quick summaries
 * Supported tickers: BTC, ETH
 */
export function useRiskScore(ticker: string, enabled: boolean = true) {
  return useQuery<RiskScoreResponse, Error>({
    queryKey: ["risk", "score", ticker],
    queryFn: () => apiClient.getRiskScore(ticker),
    enabled: !!ticker && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
