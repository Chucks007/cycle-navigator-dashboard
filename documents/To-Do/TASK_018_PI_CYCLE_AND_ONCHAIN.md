# Task 018: Pi Cycle & On-Chain Indicators

**Status**: Pending
**Priority**: Medium
**Created**: 2026-01-29

## Context
Specific technical and on-chain indicators have historically been highly accurate at predicting Bitcoin cycle tops and bottoms. Integrating these provides "Alpha" beyond standard price analysis.

## Objective
Implement "Pi Cycle Top" and "MVRV Z-Score" indicators.

## Implementation Plan

### 1. Pi Cycle Top Indicator (Technical)
*   **Logic:**
    *   **111 DMA:** 111-day Simple Moving Average.
    *   **350 DMA x 2:** 350-day Simple Moving Average multiplied by 2.
*   **Signal:** When 111 DMA crosses *above* 350 DMA x 2, a Cycle Top is signaled.
*   **Backend:** Add calculation to `StockService.get_indicators` or dedicated `CryptoService`.
*   **Frontend:** Add as a toggleable overlay on the BTC chart.

### 2. MVRV Z-Score (On-Chain)
*   **Logic:**
    *   `MVRV Z-Score = (Market Value - Realized Value) / StdDev(Market Value)`
*   **Data Source:** Requires "Realized Price/Value" data.
    *   *Challenge:* Yahoo Finance does NOT provide Realized Price.
    *   *Solution:* Need a crypto-specific API (CoinGecko usually doesn't provide on-chain data for free; might need Glassnode free tier or a proxy calculation).
    *   *Fallback:* If true on-chain data is unavailable, implement the **Puell Multiple** (Mining Revenue / 365 MA) if mining data is accessible, or stick to Pi Cycle (Price-based) only for now.

### 3. API Integration
*   Check if CoinGecko (via `pycoingecko` in `backend/services/crypto.py`) offers necessary data points.
*   If not, scope this task to **Pi Cycle Only** for the MVP.

## Verification
*   **Pi Cycle:** Verify the indicator correctly highlights the April 2021 and Dec 2017 tops on historical charts.
