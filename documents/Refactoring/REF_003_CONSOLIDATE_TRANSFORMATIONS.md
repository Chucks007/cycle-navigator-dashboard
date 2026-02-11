# Refactor 003: Consolidate Data Transformations

## Objective
Unify the data transformation logic used between `series-utils.ts` and `chart-utils.ts` to reduce duplication and improve testability.

## Current Issues
- `series-utils.ts` handles inflation adjustments.
- `chart-utils.ts` handles Lightweight Charts formatting (Area, Line, Histogram).
- Logic for "aligning timestamps" and "indexing to 100" is scattered.

## Proposed Structure
Create `web/src/lib/transformations/`:
- `inflation.ts`: Logic moved from `series-utils.ts`.
- `chart-adapters.ts`: Logic moved from `chart-utils.ts` to convert domain data to chart-specific formats.
- `alignment.ts`: Shared logic for resampling and timestamp syncing.

## Implementation Plan
1. [ ] Create `web/src/lib/transformations/` directory.
2. [ ] Move mathematical/alignment logic into dedicated files.
3. [ ] Update existing hooks (`use-inflation-adjusted-data.ts`) to use the new transformation library.
4. [ ] Ensure unit tests are moved and updated for the new structure.

## Acceptance Criteria
1. No duplicated logic for indexing or resampling.
2. Domain logic (math) is separated from view logic (chart formatting).
3. All tests pass.
