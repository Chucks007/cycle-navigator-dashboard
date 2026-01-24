/**
 * Zustand Stores Index
 * 
 * Central export point for all Zustand stores.
 */

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
