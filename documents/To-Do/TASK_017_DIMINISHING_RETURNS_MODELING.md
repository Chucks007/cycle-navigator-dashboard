# Task 017: Diminishing Returns Modeling

**Status**: Pending
**Priority**: Low
**Created**: 2026-01-29

## Context
To predict potential cycle tops for Bitcoin, simple linear extrapolation fails. Bitcoin exhibits "Diminishing Returns," where each cycle's ROI is lower than the last. A Logarithmic Regression model is needed to visualize this decay.

## Objective
Implement a backend service to calculate and serve Logarithmic Regression Curves with "Diminishing Returns" adjustments for Bitcoin.

## Implementation Plan

### 1. Mathematical Model (Backend)
*   **Formula:** Implement the "Logarithmic Growth Curve" model.
    *   Base function: `y = 10^(a * log10(x) + b)` where `y` = price, `x` = days since inception.
    *   Alternatively, use the specific "Rainbow Chart" formula: `Price = 10^(2.94 * ln(days) - 1.5)` (example coefficients, need fitting).
*   **Fitting:** Use `scipy.optimize.curve_fit` to calculate the best `a` and `b` coefficients based on historical BTC data.

### 2. Service Update
*   Update `backend/services/risk.py` or create `backend/services/modeling.py`.
*   Add `get_diminishing_returns_curves(ticker='BTC')`.
*   Return data series for:
    *   "Fair Value" (The regression fit line).
    *   "Cycle Top" Band (e.g., +2 Standard Deviations or a fitted "Top" curve).
    *   "Cycle Bottom" Band.

### 3. Frontend Visualization
*   Integrate this data into the `RiskChart` (already exists).
*   Add a toggle to switch between "Linear Bands" (standard deviation) and "Diminishing Returns" (Log Regression) models.

## References
*   Logarithmic Regression: `y = a + b * ln(x)`
*   Diminishing Returns Decay: The slope `b` effectively captures the slowing growth rate in log space.

## Verification
*   Check the BTC Risk Chart.
*   The "Top" band should be much lower for 2025 than it would have been if projected linearly from 2017.
