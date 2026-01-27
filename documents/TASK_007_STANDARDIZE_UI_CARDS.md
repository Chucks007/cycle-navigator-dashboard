# Task 007: Standardize Dashboard Cards (UI Primitive)

**Status**: Pending
**Priority**: Medium
**Created**: 2026-01-26

## Context
The application uses a consistent "glassmorphism" look for cards (charts, metrics, etc.). Currently, the Tailwind CSS classes implementing this look (borders, background opacity, blurs, shadows) are repeated in multiple component files:
- `macro-metric-card.tsx`
- `expandable-chart-card.tsx`
- Inline cards in `barbell/page.tsx` and `ticker/page.tsx`

## Objective
Create a shared, reusable UI primitive component for "Dashboard Cards" to enforce design consistency and reduce CSS duplication.

## Implementation Plan

### 1. Create Component
Create `web/src/components/ui/dashboard-card.tsx`.
- It should accept `children`, `className`, and potentially variants (e.g., `default`, `interactive`).
- It should encapsulate the core Tailwind classes: `bg-card/50 backdrop-blur-sm border-white/10` etc.

### 2. Update Consumers
Refactor existing components to use `<DashboardCard>` instead of `<div>` with repeated classes:
- `web/src/components/macro/macro-metric-card.tsx`
- `web/src/components/charts/expandable-chart-card.tsx`
- The new components extracted in Task 005 and 006.

## Benefits
- **Consistency**: Changing the card style (e.g., corner radius or border color) is done in one place.
- **Dry Code**: Removes visual noise from logic components.
