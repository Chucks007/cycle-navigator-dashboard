# Task 015: Implement Portfolio Heatmap

**Status**: Pending
**Priority**: Low
**Created**: 2026-01-29

## Context
The current "Barbell Strategy" page uses simple lists and cards. To provide a professional "Macro Watchtower" experience, a visual heatmap (Treemap) is needed to show the relative size and performance of assets in the "Growth" vs. "Hard Asset" buckets.

## Objective
Create a visual Treemap component to display the "Barbell" portfolio allocation and performance.

## Implementation Plan

### 1. Component Selection
*   Use a library capable of Treemaps, such as `recharts` (ResponsiveContainer, Treemap) or `nivo` (if already in use/preferred).
*   Alternatively, `lightweight-charts` does *not* support Treemaps, so a separate SVG/Canvas implementation or library is needed. `recharts` is recommended for React integration.

### 2. Data Structure
*   Define the hierarchy:
    *   Root
        *   Branch: "Hard Assets" (Gold, BTC, Silver)
        *   Branch: "Paper/Growth Assets" (Stocks, Bonds)
*   Metrics to visualize:
    *   **Size (Area):** Allocation % or Market Cap.
    *   **Color:** Performance (Green for positive, Red for negative).

### 3. Frontend Implementation
*   Create `web/src/components/features/barbell/portfolio-heatmap.tsx`.
*   Fetch data using `useBarbellPortfolio` (or similar).
*   Render the Treemap.

### 4. Integration
*   Add the Heatmap to `web/src/app/barbell/page.tsx`, likely above the list views.

## Verification
*   Visit `/barbell`.
*   Verify a rectangular heatmap appears.
*   Check that "Hard Assets" and "Paper Assets" are distinct groups.
*   Verify color coding matches the daily/weekly change.
