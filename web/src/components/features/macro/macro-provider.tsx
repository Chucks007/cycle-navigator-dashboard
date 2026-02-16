"use client";

import * as React from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  LiquidityPoint,
  DebtPoint,
  RealRatePoint,
  CPIPoint,
} from "@/schemas/api-types";
import {
  useMacroPreferences,
  timeframeToDays,
} from "@/stores/macro-preferences";
import type { Timeframe } from "@/components/charts/chart-controls";

// ============================================
// Types
// ============================================

export interface MacroMetadata {
  lastUpdated: string | null;
  isStale: boolean;
  isLoading: boolean;
  error: Error | null;
}

export interface MacroDataState {
  liquidity: LiquidityPoint[] | null;
  debtStatus: DebtPoint[] | null;
  realRates: RealRatePoint[] | null;
  cpi: CPIPoint[] | null;
}

export interface MacroContextValue {
  data: MacroDataState;
  metadata: MacroMetadata;
  days: number | undefined;
  setDays: (days: number | undefined) => void;
  // Timeframe from Zustand store (shared across charts)
  timeframe: Timeframe;
  setTimeframe: (timeframe: Timeframe) => void;
  adjustForInflation: boolean;
  setAdjustForInflation: (value: boolean) => void;
  refetch: () => void;
}

// ============================================
// Context
// ============================================

const MacroContext = React.createContext<MacroContextValue | null>(null);

// ============================================
// Provider Component
// ============================================

interface MacroProviderProps {
  children: React.ReactNode;
  initialDays?: number;
}

export function MacroProvider({ children, initialDays }: MacroProviderProps) {
  // Get global timeframe from Zustand store (persisted)
  const {
    timeframe,
    setTimeframe,
    liquidity: liquidityPrefs,
  } = useMacroPreferences();

  // Derive days from persisted timeframe, or use initialDays as fallback
  const derivedDays = React.useMemo(() => {
    if (initialDays !== undefined) return initialDays;
    return timeframeToDays(timeframe);
  }, [initialDays, timeframe]);

  const [days, setDays] = React.useState<number | undefined>(derivedDays);

  // Sync days when timeframe changes (Zustand -> local state)
  React.useEffect(() => {
    if (initialDays === undefined) {
      setDays(timeframeToDays(timeframe));
    }
  }, [timeframe, initialDays]);

  // Get inflation adjustment from Zustand store (per-chart, but we expose it globally for CPI fetching)
  const [adjustForInflation, setAdjustForInflation] = React.useState(
    liquidityPrefs.adjustForInflation
  );

  // Sync with store changes
  React.useEffect(() => {
    setAdjustForInflation(liquidityPrefs.adjustForInflation);
  }, [liquidityPrefs.adjustForInflation]);

  // Fetch all macro data in parallel using useQueries
  const queries = useQueries({
    queries: [
      {
        queryKey: ["macro", "liquidity", days],
        queryFn: () => apiClient.getLiquidity(days),
        staleTime: 5 * 60 * 1000, // 5 minutes
      },
      {
        queryKey: ["macro", "debt-status", days],
        queryFn: () => apiClient.getDebtStatus(days),
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ["macro", "real-rates"],
        queryFn: () => apiClient.getRealRates(),
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ["macro", "cpi", days],
        queryFn: () => apiClient.getCpi(days),
        staleTime: 5 * 60 * 1000,
        // Always fetch CPI so inflation toggle is instant
        enabled: true,
      },
    ],
  });

  const [liquidityQuery, debtQuery, realRatesQuery, cpiQuery] = queries;

  // Aggregate loading and error states
  const isLoading = queries.some((q) => q.isLoading);
  const error = queries.find((q) => q.error)?.error as Error | null;

  // Build aggregated data state
  const data: MacroDataState = React.useMemo(
    () => ({
      liquidity: liquidityQuery.data ?? null,
      debtStatus: debtQuery.data ?? null,
      realRates: realRatesQuery.data ?? null,
      cpi: cpiQuery.data ?? null,
    }),
    [liquidityQuery.data, debtQuery.data, realRatesQuery.data, cpiQuery.data]
  );

  // Build metadata
  const metadata: MacroMetadata = React.useMemo(
    () => ({
      lastUpdated: new Date().toISOString(),
      isStale: queries.some((q) => q.isStale),
      isLoading,
      error,
    }),
    [queries, isLoading, error]
  );

  // Refetch all queries
  const refetch = React.useCallback(() => {
    queries.forEach((q) => q.refetch());
  }, [queries]);

  const contextValue: MacroContextValue = React.useMemo(
    () => ({
      data,
      metadata,
      days,
      setDays,
      timeframe,
      setTimeframe,
      adjustForInflation,
      setAdjustForInflation,
      refetch,
    }),
    [data, metadata, days, timeframe, setTimeframe, adjustForInflation, refetch]
  );

  return (
    <MacroContext.Provider value={contextValue}>
      {children}
    </MacroContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useMacroContext(): MacroContextValue {
  const context = React.useContext(MacroContext);
  if (!context) {
    throw new Error("useMacroContext must be used within a MacroProvider");
  }
  return context;
}

// ============================================
// Convenience Hooks (for gradual migration)
// ============================================

/**
 * Hook to get liquidity data from the macro context.
 * Falls back to direct fetch if used outside provider.
 */
export function useMacroLiquidity() {
  const context = React.useContext(MacroContext);
  
  // If outside provider, fall back to direct query
  const directQuery = useQuery<LiquidityPoint[], Error>({
    queryKey: ["macro", "liquidity", undefined],
    queryFn: () => apiClient.getLiquidity(),
    staleTime: 5 * 60 * 1000,
    enabled: !context, // Only run if not in provider
  });

  if (context) {
    return {
      data: context.data.liquidity,
      isLoading: context.metadata.isLoading,
      error: context.metadata.error,
    };
  }

  return directQuery;
}

/**
 * Hook to get CPI data from the macro context.
 * Always returns CPI data regardless of days filter.
 */
export function useMacroCpi() {
  const context = React.useContext(MacroContext);
  
  // If outside provider, fall back to direct query
  const directQuery = useQuery<CPIPoint[], Error>({
    queryKey: ["macro", "cpi", undefined],
    queryFn: () => apiClient.getCpi(),
    staleTime: 5 * 60 * 1000,
    enabled: !context,
  });

  if (context) {
    return {
      data: context.data.cpi,
      isLoading: context.metadata.isLoading,
      error: context.metadata.error,
    };
  }

  return directQuery;
}

/**
 * Hook to get debt status data from the macro context.
 */
export function useMacroDebtStatus() {
  const context = React.useContext(MacroContext);
  
  const directQuery = useQuery<DebtPoint[], Error>({
    queryKey: ["macro", "debt-status", undefined],
    queryFn: () => apiClient.getDebtStatus(),
    staleTime: 5 * 60 * 1000,
    enabled: !context,
  });

  if (context) {
    return {
      data: context.data.debtStatus,
      isLoading: context.metadata.isLoading,
      error: context.metadata.error,
    };
  }

  return directQuery;
}

/**
 * Hook to get real rates data from the macro context.
 */
export function useMacroRealRates() {
  const context = React.useContext(MacroContext);
  
  const directQuery = useQuery<RealRatePoint[], Error>({
    queryKey: ["macro", "real-rates"],
    queryFn: () => apiClient.getRealRates(),
    staleTime: 5 * 60 * 1000,
    enabled: !context,
  });

  if (context) {
    return {
      data: context.data.realRates,
      isLoading: context.metadata.isLoading,
      error: context.metadata.error,
    };
  }

  return directQuery;
}

/**
 * Hook to get inflation adjustment state.
 */
export function useInflationAdjustment() {
  const context = React.useContext(MacroContext);
  
  const [localAdjust, setLocalAdjust] = React.useState(false);
  
  if (context) {
    return {
      adjustForInflation: context.adjustForInflation,
      setAdjustForInflation: context.setAdjustForInflation,
      cpiData: context.data.cpi,
      isLoading: context.metadata.isLoading,
    };
  }

  // Fallback when outside provider
  return {
    adjustForInflation: localAdjust,
    setAdjustForInflation: setLocalAdjust,
    cpiData: null,
    isLoading: false,
  };
}
