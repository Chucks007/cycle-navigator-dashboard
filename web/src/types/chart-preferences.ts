/**
 * Chart Preferences Type Definitions
 * 
 * Centralized types for Zustand state management.
 * These types define the shape of user preferences for charts across the application.
 */

import type { Timeframe } from "@/components/charts/chart-controls";

// ============================================
// Macro Dashboard Preferences
// ============================================

/**
 * Per-chart indicator preferences.
 * Each macro chart (liquidity, debt, rates) can have its own indicator settings.
 */
export interface ChartIndicatorPreferences {
  showSMA: boolean;
  showEMA: boolean;
  logScale: boolean;
  adjustForInflation: boolean; // Only applicable to M2/Liquidity
}

/**
 * Macro dashboard preferences state.
 * 
 * Design decisions:
 * - `timeframe` is SHARED (global) for regime analysis correlation
 * - `indicators` are ISOLATED (per-chart) for flexibility
 */
export interface MacroPreferencesState {
  // Shared across all macro charts
  timeframe: Timeframe;
  
  // Per-chart indicator preferences (isolated)
  liquidity: ChartIndicatorPreferences;
  debtStatus: Omit<ChartIndicatorPreferences, "showEMA" | "adjustForInflation">;
  realRates: Omit<ChartIndicatorPreferences, "showEMA" | "adjustForInflation">;
  dominance: Pick<ChartIndicatorPreferences, "logScale">; // Minimal - stacked area chart
}

/**
 * Actions for the macro preferences store.
 */
export interface MacroPreferencesActions {
  // Global timeframe
  setTimeframe: (timeframe: Timeframe) => void;
  
  // Per-chart indicator setters
  setLiquidityPrefs: (prefs: Partial<ChartIndicatorPreferences>) => void;
  setDebtStatusPrefs: (prefs: Partial<MacroPreferencesState["debtStatus"]>) => void;
  setRealRatesPrefs: (prefs: Partial<MacroPreferencesState["realRates"]>) => void;
  setDominancePrefs: (prefs: Partial<MacroPreferencesState["dominance"]>) => void;
  
  // Bulk reset
  reset: () => void;
}

export type MacroPreferencesStore = MacroPreferencesState & MacroPreferencesActions;

// ============================================
// Ticker/Stock Preferences
// ============================================

export type ChartType = "line" | "candlestick";

/**
 * Ticker analysis page preferences state.
 */
export interface TickerPreferencesState {
  timeframe: Timeframe;
  chartType: ChartType;
  logScale: boolean;
  showRiskBands: boolean;
}

/**
 * Actions for the ticker preferences store.
 */
export interface TickerPreferencesActions {
  setTimeframe: (timeframe: Timeframe) => void;
  setChartType: (chartType: ChartType) => void;
  setLogScale: (logScale: boolean) => void;
  setShowRiskBands: (showRiskBands: boolean) => void;
  reset: () => void;
}

export type TickerPreferencesStore = TickerPreferencesState & TickerPreferencesActions;

// ============================================
// Utility Types
// ============================================

/**
 * Helper type for extracting just the state portion of a store.
 */
export type StoreState<T> = T extends (...args: unknown[]) => unknown ? never : T;

/**
 * Chart IDs for macro charts (used in per-chart preferences).
 */
export type MacroChartId = "liquidity" | "debtStatus" | "realRates" | "dominance";
