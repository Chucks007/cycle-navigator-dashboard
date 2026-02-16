"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { CryptoDominanceResponse } from "@/schemas/api-types";

export function useCryptoDominance(days: number = 365) {
  return useQuery<CryptoDominanceResponse, Error>({
    queryKey: ["crypto", "dominance", days],
    queryFn: () => apiClient.getCryptoDominance(days),
    staleTime: 5 * 60 * 1000,
  });
}
