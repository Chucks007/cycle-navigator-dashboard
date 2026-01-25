/**
 * Ticker Analysis Preferences Store
 * 
 * Manages chart preferences for the Ticker Analysis page (/ticker).
 * 
 * Separate from macro preferences to avoid "state pollution" -
 * settings for stock analysis are distinct from macro regime analysis.
 * 
 * Persisted to localStorage via Zustand middleware.
 * Devtools enabled in development for debugging.
 */

import { create } from "zustand";
import { persist, devtools, createJSONStorage } from "zustand/middleware";
import type {
  TickerPreferencesStore,
  TickerPreferencesState,
  ChartType,
} from "@/types/chart-preferences";
import type { Timeframe } from "@/components/charts/chart-controls";

// ============================================
// Default Values
// ============================================

const DEFAULT_STATE: TickerPreferencesState = {
  // Default to ALL for full historical context
  timeframe: "ALL" as Timeframe,
  // Line chart is more useful for long-term analysis
  chartType: "line" as ChartType,
  // Log scale recommended for crypto/volatile assets
  logScale: true,
  // Risk bands off by default (requires additional API call)
  showRiskBands: false,
};

// ============================================
// Store Creation
// ============================================

/**
 * Ticker preferences store with persistence and devtools.
 * 
 * Usage:
 * ```tsx
 * const { timeframe, setTimeframe, logScale, setLogScale } = useTickerPreferences();
 * ```
 */
export const useTickerPreferences = create<TickerPreferencesStore>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        ...DEFAULT_STATE,

        // Setters
        setTimeframe: (timeframe: Timeframe) =>
          set({ timeframe }, false, "setTimeframe"),

        setChartType: (chartType: ChartType) =>
          set({ chartType }, false, "setChartType"),

        setLogScale: (logScale: boolean) =>
          set({ logScale }, false, "setLogScale"),

        setShowRiskBands: (showRiskBands: boolean) =>
          set({ showRiskBands }, false, "setShowRiskBands"),

        // Reset all preferences to defaults
        reset: () => set(DEFAULT_STATE, false, "reset"),
      }),
      {
        name: "ticker-preferences",
        // Use safe storage that handles SSR (returns undefined on server)
        storage: createJSONStorage(() => 
          typeof window !== "undefined" ? localStorage : {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          }
        ),
      }
    ),
    {
      name: "TickerPreferences",
      enabled: process.env.NODE_ENV === "development",
    }
  )
);

// ============================================
// Selector Hooks (for performance optimization)
// ============================================

/**
 * Select chart display preferences (type, scale).
 */
export const useTickerChartDisplay = () => {
  const chartType = useTickerPreferences((s) => s.chartType);
  const setChartType = useTickerPreferences((s) => s.setChartType);
  const logScale = useTickerPreferences((s) => s.logScale);
  const setLogScale = useTickerPreferences((s) => s.setLogScale);
  return { chartType, setChartType, logScale, setLogScale };
};

/**
 * Select risk band preferences.
 */
export const useTickerRiskBands = () => {
  const showRiskBands = useTickerPreferences((s) => s.showRiskBands);
  const setShowRiskBands = useTickerPreferences((s) => s.setShowRiskBands);
  return { showRiskBands, setShowRiskBands };
};

// ============================================
// Utilities
// ============================================

/**
 * Map timeframe to yfinance period/interval for API calls.
 * 
 * This matches the existing logic in ticker/page.tsx
 */
export function timeframeToPeriodInterval(timeframe: Timeframe): {
  period: string;
  interval: string;
} {
  const mapping: Record<Timeframe, { period: string; interval: string }> = {
    "1D": { period: "1d", interval: "1m" },
    "1W": { period: "5d", interval: "5m" },
    "1M": { period: "1mo", interval: "1h" },
    "6M": { period: "6mo", interval: "1d" },
    "1Y": { period: "1y", interval: "1d" },
    "5Y": { period: "5y", interval: "1wk" },
    "ALL": { period: "max", interval: "1wk" },
  };
  return mapping[timeframe];
}
