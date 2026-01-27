# Task 005: Refactor Barbell Page Components

**Status**: Pending
**Priority**: High
**Created**: 2026-01-26

## Context
The file `web/src/app/barbell/page.tsx` has grown to over 1100 lines. It contains the main page logic mixed with several inline UI components (e.g., `ExpandablePerformanceCard`, `ExpandableBucketCard`, `MetricCard`).

This monolithic structure makes the code:
- Hard to read and navigate.
- Difficult to test (cannot unit test the sub-components easily).
- Hard to maintain (state logic is mixed with presentation).

## Objective
Extract inline components from `web/src/app/barbell/page.tsx` into dedicated files within a new feature directory.

## Implementation Plan

### 1. Create Directory Structure
Create `web/src/components/features/barbell/` to house the extracted components.

### 2. Extract Components
Identify and move the following internal components to their own files:
- `ExpandablePerformanceCard` -> `web/src/components/features/barbell/performance-card.tsx`
- `ExpandableBucketCard` -> `web/src/components/features/barbell/bucket-card.tsx`
- `MetricCard` -> `web/src/components/features/barbell/metric-card.tsx`
- Any specific chart wrappers (e.g., `BarbellCompositionChart`).

### 3. Refactor Page
- Update `web/src/app/barbell/page.tsx` to import these new components.
- Ensure all props are correctly typed and passed down.

## Benefits
- **Readability**: Reduces the main page file size by ~60-70%.
- **Reusability**: Components can be reused in other parts of the barbell feature if needed.
- **Maintainability**: Clear separation between page-level data fetching/state and component-level rendering.
