# Task 020: Web Component Architecture Refactoring [COMPLETE]

## Objective
Standardize the frontend component structure by grouping feature-specific components under `components/features/` and layout components under `components/layout/`. This improves discoverability and scales better as the application grows.

## Current Issues
1. **Inconsistent Feature Placement:** `components/macro/` exists at the root, while other features (ticker, barbell) are in `components/features/`.
2. **Cluttered Components Root:** Layout files (`app-sidebar.tsx`, `top-nav.tsx`, etc.) are mixed in the root `components/` directory.

## Proposed Structure

```
web/src/components/
├── features/
│   ├── barbell/
│   ├── macro/            # Moved from components/macro/
│   └── ticker/
├── layout/               # New directory for shell/nav components
│   ├── app-sidebar.tsx
│   ├── top-nav.tsx
│   ├── sub-nav.tsx
│   ├── command-search.tsx
│   ├── mode-toggle.tsx
│   └── providers.tsx
├── charts/
└── ui/
```

## Implementation Plan

### Phase 1: Macro Feature Migration
- [x] Move `web/src/components/macro/` to `web/src/components/features/macro/`.
- [x] Update imports in `web/src/app/page.tsx` (Dashboard).
- [x] Update imports in any other consuming files.

### Phase 2: Layout Component Organization
- [x] Create `web/src/components/layout/`.
- [x] Move the following files to `web/src/components/layout/`:
    - `app-sidebar.tsx`
    - `command-search.tsx`
    - `mode-toggle.tsx`
    - `providers.tsx`
    - `sub-nav.tsx`
    - `top-nav.tsx`
- [x] Update imports in `web/src/app/layout.tsx`.
- [x] Update imports in `web/src/app/page.tsx` and other pages.

### Phase 3: Verification
- [x] Run type check: `npm run typecheck`
- [x] Run linting: `npm run lint`
- [x] Verify application build: `npm run build`
- [x] Manual check of Dashboard and Navigation to ensure no broken styles/links.

## Acceptance Criteria
1. `web/src/components/` root is clean (only directories).
2. All macro components reside in `components/features/macro/`.
3. All layout components reside in `components/layout/`.
4. Build passes without TypeScript errors.
