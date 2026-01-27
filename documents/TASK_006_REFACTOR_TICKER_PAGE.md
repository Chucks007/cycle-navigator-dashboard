# Task 006: Refactor Ticker Page Components

**Status**: Pending
**Priority**: High
**Created**: 2026-01-26

## Context
Similar to the Barbell page, `web/src/app/ticker/page.tsx` is bloated (~740 lines). It likely contains inline components for:
- Price charts/toggles
- Sentiment gauges
- Indicator displays
- Financial metric tables

## Objective
Extract inline components into a dedicated `web/src/components/features/ticker/` directory.

## Implementation Plan

### 1. Create Directory Structure
Create `web/src/components/features/ticker/`.

### 2. Extract Components
Extract logical UI units such as:
- `SentimentGauge` -> `web/src/components/features/ticker/sentiment-gauge.tsx`
- `IndicatorDisplay` -> `web/src/components/features/ticker/indicator-display.tsx`
- `ChartTypeToggle` -> `web/src/components/features/ticker/chart-toggle.tsx`
- `FinancialsTable` -> `web/src/components/features/ticker/financials-table.tsx`

### 3. Refactor Page
- Update `web/src/app/ticker/page.tsx` to import and use these components.

## Benefits
- Drastic reduction in page file size.
- Improved developer experience when working on specific features (e.g., just the sentiment gauge).
