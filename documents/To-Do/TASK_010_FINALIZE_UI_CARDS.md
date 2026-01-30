# Task 010: Finalize UI Card Standardization

**Status**: Pending
**Priority**: Medium
**Created**: 2026-01-29

## Context
A new UI primitive `DashboardCard` was created (Task 007) to enforce a consistent "glassmorphism" style across the application. However, several components still use the legacy shadcn `Card` component or raw HTML `div`s with inline Tailwind classes. This results in visual inconsistencies (different borders, shadows, opacity).

## Objective
Refactor remaining card-like components to use the `DashboardCard` primitive.

## Scope & Files to Change

1.  **Risk Chart Components**
    *   File: `web/src/components/charts/risk-chart.tsx`
    *   Component: `RiskScoreCard`
    *   Action: Replace `Card` with `DashboardCard`.

2.  **Loading Skeletons**
    *   File: `web/src/components/ui/loading-skeletons.tsx`
    *   Components: `ChartSkeleton`, `MetricCardSkeleton`
    *   Action: Replace `Card` with `DashboardCard`.

3.  **Error Boundary**
    *   File: `web/src/components/ui/error-boundary.tsx`
    *   Component: `ErrorBoundary` fallback UI
    *   Action: Replace `Card` with `DashboardCard`.

4.  **Macro Metric Card**
    *   File: `web/src/components/macro/macro-metric-card.tsx`
    *   Action: Identify the raw `div` (Line ~196) used for error states or containers and replace with `DashboardCard`.

## Verification
*   Visual inspection of the Ticker page (Risk section), Dashboard (Skeletons/Loading states), and Error states.
*   Ensure no functionality is lost (e.g., click handlers on interactive cards).
