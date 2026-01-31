# Task 014: Implement Purchasing Power Toggle

**Status**: Pending
**Priority**: Medium
**Created**: 2026-01-29

## Context
The "Purchasing Power" toggle currently exists in the frontend UI (`MacroMetricCard` and controls), but the logic to perform the adjustment is incomplete or inconsistent across different charts. The goal is to allow users to view asset prices (stocks, crypto, etc.) denominated in "real" terms by dividing the nominal price by a liquidity metric (M2 Supply) or inflation metric (CPI).

## Objective
Implement a robust, global state-driven "Purchasing Power" mode that adjusts all relevant price charts by dividing the asset price by the M2 Money Supply (or CPI).

## Implementation Plan

### 1. Global State Management
*   Ensure `useMacroPreferences` (or similar store) tracks a `purchasingPowerMode` boolean or enum (e.g., `NOMINAL`, `REAL_M2`, `REAL_CPI`).
*   Ensure this state persists across sessions.

### 2. Backend Data Support (Optional but Recommended)
*   If performing the division on the frontend is too heavy or requires fetching extra data every time, consider adding a backend endpoint parameter (e.g., `?adjust_by=m2`) to `get_stock_history`.
*   *Current Preference:* Frontend-side transformation is likely sufficient if M2 data is cached in the browser.

### 3. Frontend Transformation Logic
*   Create a utility hook `useInflationAdjustedData(priceData, adjustmentSeries)` that:
    1.  Aligns the timestamps of the price data and the adjustment series (M2/CPI).
    2.  Interpolates the adjustment series (since M2 is monthly/weekly and price is daily).
    3.  Returns the adjusted price series: `AdjustedPrice = NominalPrice / AdjustmentValue`.
    4.  Normalizes the result if needed (e.g., to an index starting at 100) to make it readable, as `Price / M2` results in tiny numbers.

### 4. Component Updates
*   Apply this logic to:
    *   `TickerAnalysisPage` (Main Price Chart)
    *   `MacroDashboard` (Relevant charts)
    *   `Comparison/Barbell` charts

## Verification
*   Toggle "Purchasing Power" on the Ticker page for "SPY".
*   Verify the chart shape changes (e.g., the 2020-2021 rally should look flatter when divided by M2).
*   Ensure tooltips display the "Real" value or a normalized index.
