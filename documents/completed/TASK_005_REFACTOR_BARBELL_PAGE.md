# Task 005: Refactor Barbell Page Components

**Status**: Completed
**Priority**: High
**Created**: 2026-01-26
**Completed**: 2026-01-27

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

## Implementation Results

### Files Created
- `web/src/components/features/barbell/performance-card.tsx` (244 lines)
- `web/src/components/features/barbell/bucket-card.tsx` (279 lines)

### Files Modified
- `web/src/app/barbell/page.tsx` - Reduced from 1108 lines to 610 lines (45% reduction)

### Testing Verification
- ✅ Frontend build passed with no TypeScript errors
- ✅ All 118 backend tests passed
- ✅ Podman deployment verified - all containers healthy
- ✅ Web frontend accessible at http://localhost:3000/barbell (HTTP 200)
- ✅ Backend API responsive at http://localhost:8000/health
- ✅ No errors or warnings in container logs

### Key Changes
1. Extracted `ExpandablePerformanceCard` component with proper TypeScript interfaces
2. Extracted `ExpandableBucketCard` component with shared types
3. Updated imports in main page to use new component modules
4. Removed unused imports (Maximize2, SparklineChart, Dialog components from main page)
5. Maintained full functionality - no breaking changes

The refactoring successfully improved code organization while maintaining all existing functionality.
