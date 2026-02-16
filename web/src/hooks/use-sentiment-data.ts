"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { SentimentResponse } from "@/schemas/api-types";

export function useSentiment(ticker: string) {
  return useQuery<SentimentResponse, Error>({
    queryKey: ["sentiment", ticker],
    queryFn: () => apiClient.getSentiment(ticker),
    enabled: !!ticker,
  });
}
