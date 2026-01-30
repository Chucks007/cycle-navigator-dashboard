# Task 011: Implement Financials Table

**Status**: Pending
**Priority**: High
**Created**: 2026-01-29

## Context
The Ticker Analysis page (`web/src/app/ticker/page.tsx`) was recently refactored, but the "Fundamentals" section is currently a placeholder text ("Fundamental analysis coming soon...").

A planned component `financials-table.tsx` was identified in previous planning (Task 006) but was never created.

## Objective
Implement the `FinancialsTable` component to display key stock fundamental metrics (Market Cap, P/E Ratio, Dividend Yield, etc.) and integrate it into the Ticker page.

## Implementation Plan

### 1. Create Component
Create `web/src/components/features/ticker/financials-table.tsx`.
*   It should accept a data object containing fundamental metrics.
*   Use `DashboardCard` as the container.
*   Display metrics in a clean, grid-based layout.

### 2. Backend Data Verification
*   Check `backend/services/stock_service.py` and `backend/schemas.py` to ensure `StockMetrics` includes necessary fields (Market Cap, PE, etc.).
*   If missing, update `yfinance` fetching logic to retrieve this data.

### 3. Integration
*   Import `FinancialsTable` in `web/src/app/ticker/page.tsx`.
*   Replace the placeholder content in the `#fundamentals` section.

## Verification
*   Navigate to `/ticker?symbol=AAPL`.
*   Verify the Fundamentals section displays real data instead of the placeholder.
