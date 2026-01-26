/**
 * Generic Preference Store Factory
 *
 * Provides utilities for creating Zustand stores with consistent patterns:
 * - localStorage persistence (SSR-safe)
 * - DevTools integration (development mode)
 * - Type-safe selectors
 *
 * This module consolidates common patterns from macro-preferences.ts
 * and ticker-preferences.ts into reusable utilities.
 */

import { create, StateCreator } from "zustand";
import { persist, devtools, createJSONStorage } from "zustand/middleware";

// ============================================
// SSR-Safe Storage
// ============================================

/**
 * SSR-safe localStorage wrapper.
 * Returns null on server, uses localStorage on client.
 */
export const safeLocalStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(name);
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(name, value);
  },
  removeItem: (name: string): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(name);
  },
};

// ============================================
// Store Configuration Types
// ============================================

export interface StoreConfig {
  /** Storage key name for localStorage persistence */
  name: string;
  /** DevTools name (defaults to PascalCase of name) */
  devtoolsName?: string;
}

// ============================================
// Create Store with Standard Middleware
// ============================================

/**
 * Create a Zustand store with the standard middleware stack:
 * - DevTools (development only)
 * - Persist (localStorage)
 * - SSR-safe storage
 *
 * @example
 * ```typescript
 * interface MyState { count: number; increment: () => void; }
 *
 * const useMyStore = createPersistedStore<MyState>(
 *   (set) => ({
 *     count: 0,
 *     increment: () => set((s) => ({ count: s.count + 1 })),
 *   }),
 *   { name: 'my-store' }
 * );
 * ```
 */
export function createPersistedStore<T>(
  storeCreator: StateCreator<T, [["zustand/devtools", never], ["zustand/persist", unknown]], []>,
  config: StoreConfig
) {
  const devtoolsName =
    config.devtoolsName ||
    config.name
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join("");

  return create<T>()(
    devtools(
      persist(storeCreator, {
        name: config.name,
        storage: createJSONStorage(() => safeLocalStorage),
      }),
      {
        name: devtoolsName,
        enabled: process.env.NODE_ENV === "development",
      }
    )
  );
}

// ============================================
// Selector Helpers
// ============================================

/**
 * Create a memoized selector hook that extracts multiple values.
 *
 * This reduces the number of store subscriptions vs calling useStore
 * multiple times with different selectors.
 *
 * @example
 * ```typescript
 * const useChartDisplay = createSelector(useMyStore, (state) => ({
 *   theme: state.theme,
 *   fontSize: state.fontSize,
 * }));
 *
 * // In component:
 * const { theme, fontSize } = useChartDisplay();
 * ```
 */
export function createSelector<TStore, TResult>(
  useStore: (selector: (state: TStore) => TResult) => TResult,
  selector: (state: TStore) => TResult
): () => TResult {
  return () => useStore(selector);
}

// ============================================
// Scoped Preference Hook Factory
// ============================================

/**
 * Create a scoped preference hook for nested store state.
 *
 * Useful for stores that have per-item preferences, like per-chart
 * indicator settings in macro-preferences.
 *
 * @example
 * ```typescript
 * // Type-safe scoped preference hook
 * export const useLiquidityPrefs = () => {
 *   const timeframe = useMacroPreferences((s) => s.timeframe);
 *   const setTimeframe = useMacroPreferences((s) => s.setTimeframe);
 *   const prefs = useMacroPreferences((s) => s.liquidity);
 *   const setPrefs = useMacroPreferences((s) => s.setLiquidityPrefs);
 *   return { ...prefs, timeframe, setTimeframe, setPrefs };
 * };
 * ```
 */
export type ScopedPreferenceHook<TPrefs, TSetPrefs> = () => TPrefs & {
  timeframe: string;
  setTimeframe: (t: string) => void;
  setPrefs: TSetPrefs;
};

