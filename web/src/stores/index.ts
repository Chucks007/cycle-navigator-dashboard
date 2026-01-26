/**
 * Zustand Stores Index
 *
 * Central export point for all Zustand stores.
 */

// Store Utilities (for creating new preference stores)
export {
  safeLocalStorage,
  createPersistedStore,
  createSelector,
} from "./create-preference-store";
export type { StoreConfig, ScopedPreferenceHook } from "./create-preference-store";

// Macro Dashboard Preferences
export {
  useMacroPreferences,
  useMacroTimeframe,
  useLiquidityPrefs,
  useDebtStatusPrefs,
  useRealRatesPrefs,
  useDominancePrefs,
  timeframeToDays,
} from "./macro-preferences";

// Ticker Analysis Preferences
export {
  useTickerPreferences,
  useTickerChartDisplay,
  useTickerRiskBands,
  timeframeToPeriodInterval,
} from "./ticker-preferences";
