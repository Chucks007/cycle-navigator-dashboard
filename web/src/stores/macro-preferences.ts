/**
 * Macro Dashboard Preferences Store
 * 
 * Manages chart preferences for the Macro Watchtower page.
 * 
 * Architecture:
 * - Timeframe is SHARED (global) for cross-chart correlation analysis
 * - Indicators (SMA, EMA, LogScale, Inflation) are ISOLATED (per-chart)
 * - Persisted to localStorage via Zustand middleware
 * - Devtools enabled in development for debugging
 */

import { create } from "zustand";
import { persist, devtools, createJSONStorage } from "zustand/middleware";
import type {
  MacroPreferencesStore,
  MacroPreferencesState,
  ChartIndicatorPreferences,
} from "@/types/chart-preferences";
import type { Timeframe } from "@/components/charts/chart-controls";

// ============================================
// Default Values
// ============================================

const DEFAULT_INDICATOR_PREFS: ChartIndicatorPreferences = {
  showSMA: false,
  showEMA: false,
  logScale: false,
  adjustForInflation: false,
};

const DEFAULT_STATE: MacroPreferencesState = {
  // Global timeframe - default to 1Y for macro analysis
  timeframe: "1Y" as Timeframe,
  
  // Per-chart defaults
  liquidity: { ...DEFAULT_INDICATOR_PREFS },
  debtStatus: {
    showSMA: false,
    logScale: false,
  },
  realRates: {
    showSMA: false,
    logScale: false,
  },
  dominance: {
    logScale: false,
  },
};

// ============================================
// Store Creation
// ============================================

/**
 * Macro preferences store with persistence and devtools.
 * 
 * Usage:
 * ```tsx
 * const { timeframe, setTimeframe, liquidity, setLiquidityPrefs } = useMacroPreferences();
 * ```
 */
export const useMacroPreferences = create<MacroPreferencesStore>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        ...DEFAULT_STATE,

        // Global timeframe setter
        setTimeframe: (timeframe: Timeframe) =>
          set({ timeframe }, false, "setTimeframe"),

        // Per-chart preference setters
        setLiquidityPrefs: (prefs: Partial<ChartIndicatorPreferences>) =>
          set(
            (state) => ({
              liquidity: { ...state.liquidity, ...prefs },
            }),
            false,
            "setLiquidityPrefs"
          ),

        setDebtStatusPrefs: (prefs: Partial<MacroPreferencesState["debtStatus"]>) =>
          set(
            (state) => ({
              debtStatus: { ...state.debtStatus, ...prefs },
            }),
            false,
            "setDebtStatusPrefs"
          ),

        setRealRatesPrefs: (prefs: Partial<MacroPreferencesState["realRates"]>) =>
          set(
            (state) => ({
              realRates: { ...state.realRates, ...prefs },
            }),
            false,
            "setRealRatesPrefs"
          ),

        setDominancePrefs: (prefs: Partial<MacroPreferencesState["dominance"]>) =>
          set(
            (state) => ({
              dominance: { ...state.dominance, ...prefs },
            }),
            false,
            "setDominancePrefs"
          ),

        // Reset all preferences to defaults
        reset: () => set(DEFAULT_STATE, false, "reset"),
      }),
      {
        name: "macro-preferences",
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
      name: "MacroPreferences",
      enabled: process.env.NODE_ENV === "development",
    }
  )
);

// ============================================
// Selector Hooks (for performance optimization)
// ============================================

/**
 * Select only the global timeframe to minimize re-renders.
 */
export const useMacroTimeframe = () => {
  const timeframe = useMacroPreferences((s) => s.timeframe);
  const setTimeframe = useMacroPreferences((s) => s.setTimeframe);
  return [timeframe, setTimeframe] as const;
};

/**
 * Select only liquidity chart preferences.
 */
export const useLiquidityPrefs = () => {
  const timeframe = useMacroPreferences((s) => s.timeframe);
  const setTimeframe = useMacroPreferences((s) => s.setTimeframe);
  const showSMA = useMacroPreferences((s) => s.liquidity.showSMA);
  const showEMA = useMacroPreferences((s) => s.liquidity.showEMA);
  const logScale = useMacroPreferences((s) => s.liquidity.logScale);
  const adjustForInflation = useMacroPreferences((s) => s.liquidity.adjustForInflation);
  const setPrefs = useMacroPreferences((s) => s.setLiquidityPrefs);
  return { timeframe, setTimeframe, showSMA, showEMA, logScale, adjustForInflation, setPrefs };
};

/**
 * Select only debt status chart preferences.
 */
export const useDebtStatusPrefs = () => {
  const timeframe = useMacroPreferences((s) => s.timeframe);
  const setTimeframe = useMacroPreferences((s) => s.setTimeframe);
  const showSMA = useMacroPreferences((s) => s.debtStatus.showSMA);
  const logScale = useMacroPreferences((s) => s.debtStatus.logScale);
  const setPrefs = useMacroPreferences((s) => s.setDebtStatusPrefs);
  return { timeframe, setTimeframe, showSMA, logScale, setPrefs };
};

/**
 * Select only real rates chart preferences.
 */
export const useRealRatesPrefs = () => {
  const timeframe = useMacroPreferences((s) => s.timeframe);
  const setTimeframe = useMacroPreferences((s) => s.setTimeframe);
  const showSMA = useMacroPreferences((s) => s.realRates.showSMA);
  const logScale = useMacroPreferences((s) => s.realRates.logScale);
  const setPrefs = useMacroPreferences((s) => s.setRealRatesPrefs);
  return { timeframe, setTimeframe, showSMA, logScale, setPrefs };
};

/**
 * Select only dominance chart preferences.
 */
export const useDominancePrefs = () => {
  const timeframe = useMacroPreferences((s) => s.timeframe);
  const setTimeframe = useMacroPreferences((s) => s.setTimeframe);
  const logScale = useMacroPreferences((s) => s.dominance.logScale);
  const setPrefs = useMacroPreferences((s) => s.setDominancePrefs);
  return { timeframe, setTimeframe, logScale, setPrefs };
};

// ============================================
// Utilities
// ============================================

/**
 * Convert timeframe to days for API calls.
 * Used by MacroProvider to initialize data fetching.
 */
export function timeframeToDays(timeframe: Timeframe): number | undefined {
  const mapping: Record<Timeframe, number | undefined> = {
    "1D": 1,
    "1W": 7,
    "1M": 30,
    "6M": 180,
    "1Y": 365,
    "5Y": 1825,
    "ALL": undefined, // No limit
  };
  return mapping[timeframe];
}
