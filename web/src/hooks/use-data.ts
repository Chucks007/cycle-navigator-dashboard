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
  type StockFundamentals,
  type SentimentResponse,
  type RiskResponse,
  type RiskScoreResponse,
  type MacroSeriesResponse,
  type AvailableOverlaysResponse,
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

/**
 * Fetch M2 money supply data for purchasing power adjustments.
 * Lazy-loaded: only fetches when enabled (e.g., purchasing power mode = REAL_M2).
 * Reuses the liquidity endpoint which returns M2 data.
 */
export function useM2Supply(days?: number, enabled: boolean = true) {
  return useQuery<LiquidityPoint[], Error>({
    queryKey: ["macro", "liquidity", days],
    queryFn: () => apiClient.getLiquidity(days),
    staleTime: 5 * 60 * 1000,
    enabled, // Only fetch when purchasing power mode requires it
  });
}

/**
 * Fetch macro series data for chart overlays.
 * Lazy-loaded: only fetches when seriesIds is non-empty.
 *
 * @param seriesIds - Array of FRED series IDs (e.g., ['M2SL', 'CPIAUCSL'])
 * @param days - Number of days of history to fetch
 * @param options - Additional options (resample to daily, etc.)
 */
export function useMacroSeries(
  seriesIds: string[],
  days?: number,
  options?: { resample?: boolean; enabled?: boolean }
) {
  const { resample = true, enabled = true } = options ?? {};

  return useQuery<MacroSeriesResponse, Error>({
    queryKey: ["macro", "series", seriesIds.sort().join(","), days, resample],
    queryFn: () => apiClient.getMacroSeries(seriesIds, days, resample),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: enabled && seriesIds.length > 0, // Only fetch when overlays are selected
  });
}

/**
 * Fetch available macro series for overlay selection UI.
 */
export function useAvailableOverlays() {
  return useQuery<AvailableOverlaysResponse, Error>({
    queryKey: ["macro", "overlays"],
    queryFn: () => apiClient.getAvailableOverlays(),
    staleTime: 60 * 60 * 1000, // 1 hour (rarely changes)
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

export function useStockFundamentals(ticker: string) {
  return useQuery<StockFundamentals, Error>({
    queryKey: ["stock", "fundamentals", ticker],
    queryFn: () => apiClient.getStockFundamentals(ticker),
    enabled: !!ticker,
    staleTime: 15 * 60 * 1000, // 15 minutes - fundamentals don't change often
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
