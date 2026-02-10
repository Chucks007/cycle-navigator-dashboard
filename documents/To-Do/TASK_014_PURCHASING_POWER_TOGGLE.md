# Task 014: Implement Purchasing Power Toggle

**Status**: Complete
**Priority**: Medium
**Created**: 2026-01-29
**Last Updated**: 2026-02-10

## Context
The "Purchasing Power" toggle currently exists in the frontend UI (`MacroMetricCard` and controls), but the logic to perform the adjustment is incomplete or inconsistent across different charts. The goal is to allow users to view asset prices (stocks, crypto, etc.) denominated in "real" terms by dividing the nominal price by a liquidity metric (M2 Supply) or inflation metric (CPI).

## Progress Update
### Completed
*   **Core Utilities:** Implemented `adjustSeriesByM2` and `adjustSeriesByCPI` in `web/src/lib/series-utils.ts` for time-series alignment and indexing.
*   **UI Components:** Created `PurchasingPowerToggle` in `web/src/components/charts/chart-controls.tsx`.
*   **Macro Integration:** `LiquidityCard` (M2 Chart) successfully implements CPI-adjustment using the toggle and `MacroMetricCard` logic.
*   **State Foundation:** `MacroPreferences` store includes `adjustForInflation` flag.
*   **Type System:** Added `PurchasingPowerMode` type (`NOMINAL | REAL_M2 | REAL_CPI`) to `web/src/types/chart-preferences.ts`.
*   **Ticker Store:** Updated `TickerPreferencesState` with `purchasingPowerMode` and `setPurchasingPowerMode` in `web/src/stores/ticker-preferences.ts`. Persists to localStorage.
*   **M2 Data Hook:** Added `useM2Supply` to `web/src/hooks/use-data.ts` with lazy loading (only fetches when mode is `REAL_M2`).
*   **Standardized Hook:** Created `useInflationAdjustedData` in `web/src/hooks/use-inflation-adjusted-data.ts` — encapsulates alignment, transformation, and indexing for any price series.
*   **Mode Selector UI:** Created `PurchasingPowerModeSelector` segmented control in `web/src/components/charts/chart-controls.tsx` (Nominal / ÷ M2 / ÷ CPI).
*   **Ticker Analysis Integration:** Integrated purchasing power mode into `/ticker` page — selector in both condensed and expanded chart controls, conditional M2/CPI fetching, adjusted line chart data, updated chart titles/subtitles, and index-aware price formatting.
*   **OHLC Candlestick Adjustment:** Added `adjustOHLCByM2` and `adjustOHLCByCPI` to `web/src/lib/series-utils.ts` — divides all four OHLC price values by the same adjustment factor and indexes to 100. Extended `useInflationAdjustedData` hook and ticker page to pass adjusted OHLC data to candlestick charts.
*   **Tooltip Refinement:** `priceFormat` now uses a custom formatter that appends `(Index)` when in adjusted mode, displayed in the floating legend overlay.
*   **Unit Tests:** Added 10 new tests for OHLC adjustment in `web/src/lib/__tests__/series-utils.test.ts` — covering M2/CPI adjustment, OHLC ordering preservation (high ≥ open/close/low), empty inputs, forward-fill, and inflation erosion. All 57 tests pass.

### Remaining
*   **End-to-End Verification:** Test with live backend data for SPY, BTC-USD to confirm chart shapes change appropriately.

## Objective
Implement a robust, global state-driven "Purchasing Power" mode that adjusts all relevant price charts by dividing the asset price by the M2 Money Supply (or CPI).

## Implementation Plan

### 1. State Management Update
*   Update `TickerPreferences` store to track `purchasingPowerMode` (e.g., `NOMINAL`, `REAL_M2`, `REAL_CPI`).
*   Ensure state persists across sessions.

### 2. Frontend Transformation Logic
*   Implement a hook that:
    1.  Aligns the timestamps of the price data and the adjustment series (M2/CPI).
    2.  Interpolates/Forward-fills the adjustment series.
    3.  Returns the adjusted price series: `AdjustedPrice = NominalPrice / AdjustmentValue`.
    4.  Indexes the result to 100 at the start of the timeframe for readability.

### 3. Ticker Page Updates
*   Add `PurchasingPowerToggle` to the Ticker page chart controls.
*   Fetch M2/CPI series on-demand when the mode is changed.
*   Apply transformation to both Line and Candlestick (OHLC) data if possible (at minimum Line data).

## Verification
*   Toggle "Purchasing Power" on the Ticker page for "SPY".
*   Verify the chart shape changes (e.g., the 2020-2021 rally should look flatter when divided by M2).
*   Ensure tooltips display the "Real" value or a normalized index.
