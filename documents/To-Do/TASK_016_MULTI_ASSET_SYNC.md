# Task 016: Implement Multi-Asset Sync

**Status**: Pending
**Priority**: High
**Created**: 2026-01-29

## Context
Currently, the Ticker Analysis (Micro) and Macro Dashboard (Macro) are separate experiences. Users cannot easily compare a specific stock's price action directly against macro indicators like Global Liquidity (M2) on the same chart.

## Objective
Enable users to overlay macro indicators (M2, Fed Balance Sheet) onto the Ticker Analysis price chart.

## Implementation Plan

### 1. Backend Updates
*   Ensure the `MacroService` exposes endpoints to fetch historical series for M2/Liquidity in a format compatible with the stock history (JSON array of `{date, value}`).

### 2. Frontend State
*   Update `TickerAnalysisPage` state to track "Overlays" (e.g., `selectedOverlays: ['M2', 'BTC']`).

### 3. Chart Integration
*   Modify `LightweightChart` or `ExpandableChartCard` to accept `overlays` prop.
*   Fetch the overlay data (e.g., `useMacroSeries('M2')`).
*   Add the overlay data as a **separate series** (usually a Line series) on the Lightweight Chart.
*   **Crucial:** Use a separate **Price Scale** (Left Axis or Overlay mode) for the macro data, as M2 values (trillions) differ vastly from stock prices.

### 4. UI Controls
*   Add an "Overlay" dropdown/multiselect to the Ticker chart controls.

## Verification
*   Go to `/ticker?symbol=SPY`.
*   Select "Global Liquidity (M2)" from the new Overlay menu.
*   Verify an orange (or distinct color) line appears over the SPY price chart.
*   Verify the axes are scaled correctly (M2 on left/hidden, Price on right).
