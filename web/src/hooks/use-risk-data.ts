"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { RiskResponse, RiskScoreResponse } from "@/types/api";

export function useRiskData(ticker: string, enabled: boolean = true) {
  return useQuery<RiskResponse, Error>({
    queryKey: ["risk", "full", ticker],
    queryFn: () => apiClient.getRiskData(ticker),
    enabled: !!ticker && enabled,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useRiskScore(ticker: string, enabled: boolean = true) {
  return useQuery<RiskScoreResponse, Error>({
    queryKey: ["risk", "score", ticker],
    queryFn: () => apiClient.getRiskScore(ticker),
    enabled: !!ticker && enabled,
    staleTime: 5 * 60 * 1000,
  });
}
