# Task 016: Implement Multi-Asset Sync

**Status**: Implemented
**Priority**: High
**Created**: 2026-01-29
**Completed**: 2026-01-31

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

## Technical Details

### Data Synchronization
- **Time Frequency Alignment**: Stock data is typically daily/intraday (e.g., 1d intervals), while macro indicators like M2 are monthly. Use resampling/interpolation (e.g., pandas `resample` with `ffill` or `interpolate`) to align timestamps. For example, forward-fill monthly M2 values to daily points to match stock chart granularity.
- **Missing Data Handling**: Macro series may have gaps (e.g., holidays, data delays). Implement fallback logic: skip missing points or use linear interpolation. Ensure overlays gracefully handle partial data availability without breaking the chart.
- **Date Range Matching**: Limit overlays to the intersection of stock and macro data ranges. If macro data starts later, truncate stock data accordingly to avoid misleading visualizations.

### Performance Optimizations
- **Caching Strategy**: Leverage existing Redis caching in `MacroService` (via `CacheKeys.macro_series`) to avoid repeated API calls. Frontend should use React Query's stale-while-revalidate for overlays, with cache keys like `['macro', seriesId, days]`.
- **Lazy Loading**: Fetch overlay data only when selected (e.g., via `useMacroSeries` hook). Avoid pre-loading all possible overlays to minimize initial page load.
- **Batch Fetching**: If multiple overlays are selected, consider a single API call (e.g., extend `/api/macro/summary` to accept series IDs) to reduce network requests.
- **Memory Management**: For large datasets, implement data downsampling (e.g., aggregate to weekly/monthly for long timeframes) to prevent chart performance issues.

## Verification
*   Go to `/ticker?symbol=SPY`.
*   Select "Global Liquidity (M2)" from the new Overlay menu.
*   Verify an orange (or distinct color) line appears over the SPY price chart.
*   Verify the axes are scaled correctly (M2 on left/hidden, Price on right).
