"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  type AvailableOverlaysResponse,
  type CPIPoint,
  type DebtPoint,
  type LiquidityPoint,
  type MacroSeriesResponse,
  type RealRatePoint,
} from "@/schemas/api-types";

// ============================================
// Macro Hooks
// ============================================

export function useLiquidity(days?: number) {
  return useQuery<LiquidityPoint[], Error>({
    queryKey: ["macro", "liquidity", days],
    queryFn: () => apiClient.getLiquidity(days),
    staleTime: 5 * 60 * 1000,
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
    enabled: days !== undefined,
  });
}

export function useM2Supply(days?: number, enabled: boolean = true) {
  return useQuery<LiquidityPoint[], Error>({
    queryKey: ["macro", "liquidity", days],
    queryFn: () => apiClient.getLiquidity(days),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useMacroSeries(
  seriesIds: string[],
  days?: number,
  options?: { resample?: boolean; enabled?: boolean }
) {
  const { resample = true, enabled = true } = options ?? {};

  return useQuery<MacroSeriesResponse, Error>({
    queryKey: ["macro", "series", seriesIds.sort().join(","), days, resample],
    queryFn: () => apiClient.getMacroSeries(seriesIds, days, resample),
    staleTime: 5 * 60 * 1000,
    enabled: enabled && seriesIds.length > 0,
  });
}

export function useAvailableOverlays() {
  return useQuery<AvailableOverlaysResponse, Error>({
    queryKey: ["macro", "overlays"],
    queryFn: () => apiClient.getAvailableOverlays(),
    staleTime: 60 * 60 * 1000,
  });
}
