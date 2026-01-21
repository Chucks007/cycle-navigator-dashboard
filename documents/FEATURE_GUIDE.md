# Feature Guide

This document provides detailed explanations of the Cycle Navigator Dashboard's key features, including their mathematical foundations, implementation details, and usage instructions.

## Table of Contents

- [M2 Purchasing Power Toggle](#m2-purchasing-power-toggle)
- [Crypto Dominance Chart](#crypto-dominance-chart)
- [Barbell Strategy Tracker](#barbell-strategy-tracker)
- [Log-Regression Risk Bands](#log-regression-risk-bands)

---

## M2 Purchasing Power Toggle

### Overview

The **Purchasing Power Toggle** enables users to adjust M2 Money Supply charts by CPI (Consumer Price Index) to visualize **real purchasing power** instead of nominal dollar values. This helps identify whether monetary expansion is outpacing inflation or being eroded by rising prices.

### Why This Matters

**Nominal M2** shows the total quantity of money in circulation, but doesn't account for inflation. A 10% increase in M2 means nothing if prices also rose 10%.

**Real M2** (CPI-adjusted) reveals whether the money supply is actually expanding purchasing power:
- **Real M2 Rising**: More liquidity relative to prices → potential for risk asset inflation
- **Real M2 Falling**: Inflation outpacing money growth → potential for deflation or tightening

### Mathematical Implementation

#### 1. Forward-Fill Alignment

M2 and CPI data are published **monthly**, while stock/crypto data is **daily**. The `alignSeriesByDate()` function handles this frequency mismatch:

```typescript
// For each daily data point:
// 1. Find the most recent CPI value where CPI.date <= data.date
// 2. Use that CPI value (forward-fill)
// 3. Handle edge cases:
//    - Drop daily points before first CPI date (dropEarly=true)
//    - Or backfill with first CPI value (dropEarly=false)

alignSeriesByDate(dailyData, monthlyCPI, { dropEarly: true })
```

**Example:**

| Date | M2 (Monthly) | CPI (Monthly) | Forward-Filled CPI |
|------|--------------|---------------|--------------------|
| Jan 1 | 21,000 | 310 | 310 |
| Jan 15 | - | - | 310 (carry forward) |
| Feb 1 | 21,500 | 315 | 315 |
| Feb 15 | - | - | 315 (carry forward) |

#### 2. CPI Adjustment Formula

```typescript
// Real M2 = Nominal M2 / (CPI / base_CPI)

// Example:
//   Nominal M2: $21,500B
//   Current CPI: 315
//   Base CPI (first date): 310
//   Real M2: 21,500 / (315 / 310) = 21,500 / 1.0161 = $21,158B
```

**Implementation:**

```typescript
function adjustSeriesByCPI(
  series: DataPoint[],
  cpiSeries: CPIPoint[]
): DataPoint[] {
  const aligned = alignSeriesByDate(series, cpiSeries);
  const baseCPI = aligned[0].cpi;  // First CPI value
  
  return aligned.map(point => ({
    date: point.date,
    value: point.value / (point.cpi / baseCPI),  // Adjust for inflation
  }));
}
```

#### 3. Indexing to 100

After CPI adjustment, values are **indexed to 100** at the first visible data point for better readability:

```typescript
// Convert absolute values to relative indices
// If Real M2 series is [21,000, 21,500, 22,000]
// Indexed result is [100.0, 102.38, 104.76]
// Formula: (value / baseValue) * 100

function indexSeriesToBase(series: DataPoint[]): DataPoint[] {
  const baseValue = series[0].value;
  return series.map(point => ({
    date: point.date,
    value: (point.value / baseValue) * 100,
  }));
}
```

### Usage

1. **Open M2 Money Supply Card** in the macro dashboard
2. **Click to Expand** the card to modal view
3. **Toggle "CPI Adj"** switch in the modal actions toolbar
4. **Chart Updates Instantly**:
   - Y-axis changes from `$18T, $20T, $22T` to `95.0, 100.0, 105.0`
   - Subtitle updates to "Purchasing power (CPI-adjusted, indexed to 100)"
   - Base date indicator appears: "Indexed to 100 at Jan 1, 2023"
   - Tooltip values show index numbers instead of dollar amounts

### Data Flow

```
User toggles CPI Adj
  ↓
useCpi() hook fetches CPI data (lazy loading)
  ↓
chartData useMemo() triggers transformation
  ↓
  1. alignSeriesByDate(m2Data, cpiData) → forward-fill to daily
  2. adjustSeriesByCPI(aligned) → calculate real values
  3. indexSeriesToBase(adjusted) → normalize to 100
  ↓
Chart re-renders with transformed data
  ↓
Formatter shows index values (e.g., "102.5")
```

### Performance Optimizations

1. **Lazy Loading**: CPI data only fetches when toggle is enabled
   ```typescript
   const { data: cpiData } = useCpi(adjustForInflation ? days : undefined);
   ```

2. **Memoization**: Transformation cached with React.useMemo
   ```typescript
   const chartData = React.useMemo(() => {
     if (!adjustForInflation || !cpiData) return originalData;
     return indexSeriesToBase(adjustSeriesByCPI(originalData, cpiData));
   }, [originalData, adjustForInflation, cpiData]);
   ```

3. **Query Caching**: React Query caches CPI data (5-minute stale time)

### Implementation Files

**Backend:**
- [backend/services/macro.py](../backend/services/macro.py) - M2 and CPI data fetching
- [backend/routers/macro.py](../backend/routers/macro.py) - API endpoints

**Frontend:**
- [web/src/lib/series-utils.ts](../web/src/lib/series-utils.ts) - Core utilities
- [web/src/lib/__tests__/series-utils.test.ts](../web/src/lib/__tests__/series-utils.test.ts) - Unit tests
- [web/src/components/charts/chart-controls.tsx](../web/src/components/charts/chart-controls.tsx) - Toggle component
- [web/src/components/macro/liquidity-card.tsx](../web/src/components/macro/liquidity-card.tsx) - Chart implementation

### Example Comparison

| Scenario | Nominal M2 | Real M2 (CPI-Adjusted) | Interpretation |
|----------|-----------|------------------------|----------------|
| **Expansion** | +10% | +12% | Real liquidity growing → risk-on |
| **Neutral** | +5% | +5% | Matching inflation → sideways |
| **Contraction** | +3% | -2% | Inflation outpacing money → risk-off |

---

## Crypto Dominance Chart

### Overview

The **Crypto Dominance Chart** visualizes liquidity flows between Bitcoin, Ethereum, and Altcoins using a **stacked area chart**. This enables identification of "Alt-Season" periods when capital rotates out of BTC/ETH into smaller-cap altcoins.

### Why This Matters

**Market Regime Signals:**
- **BTC Dominance Rising** (blue area expanding): Risk-off, flight to quality
- **ETH Dominance Stable** (purple area): Smart contract platforms holding value
- **OTHERS Dominance Rising** (green area expanding): **Alt-Season** → speculative risk-on

### Data Sources

**CoinGecko API:**
- **Total Market Cap**: Global crypto market capitalization (USD)
- **BTC Dominance**: Bitcoin's percentage of total market cap
- **ETH Dominance**: Ethereum's percentage of total market cap

### Calculation: Altcoin Market Cap

```typescript
// "OTHERS" represents all cryptocurrencies except BTC and ETH
altcoin_mcap = total_mcap × (100 - btc_dominance - eth_dominance) / 100

// Example:
//   Total Market Cap: $3.5T
//   BTC Dominance: 45.5%
//   ETH Dominance: 17.2%
//   OTHERS Dominance: 37.3%
//   Altcoin Market Cap: $3.5T × 0.373 = $1.31T
```

**Backend Implementation:**

```python
# backend/services/crypto.py
def get_current_snapshot():
    global_data = coingecko_client.get_global()
    
    total_mcap = global_data['total_market_cap']['usd']
    btc_dominance = global_data['market_cap_percentage']['btc']
    eth_dominance = global_data['market_cap_percentage']['eth']
    
    # Calculate altcoin market cap
    others_percentage = 100 - btc_dominance - eth_dominance
    altcoin_mcap = total_mcap * (others_percentage / 100)
    
    return {
        'total_mcap': total_mcap,
        'btc_dominance': btc_dominance,
        'eth_dominance': eth_dominance,
        'altcoin_mcap': altcoin_mcap,
    }
```

### Visualization: Stacked Area Chart

**Chart Layers (bottom to top):**
1. **Bitcoin** (blue) - Base layer
2. **Ethereum** (purple) - Middle layer
3. **OTHERS** (green) - Top layer

**Visual Interpretation:**
- **Alt-Season Expansion**: Green area grows relative to blue/purple
- **BTC Flight-to-Safety**: Blue area expands, green area shrinks
- **ETH Strength**: Purple area holds steady or expands

### API Endpoint

**GET /api/crypto/dominance**

**Query Parameters:**
- `days` (optional, default: 365): Number of days of historical data

**Response:**

```json
{
  "data": [
    {
      "timestamp": "2026-01-21T12:00:00Z",
      "total_mcap": 3500000000000,
      "btc_dominance": 45.5,
      "eth_dominance": 17.2,
      "altcoin_mcap": 1305250000000
    }
  ],
  "metadata": {
    "last_updated": "2026-01-21T02:15:00Z",
    "is_stale": false
  }
}
```

### Background Worker Schedule

**Daily Update at 2:15 AM UTC:**

```python
# backend/tasks/crypto_tasks.py
@celery_app.task(bind=True, max_retries=3)
def update_crypto_metrics(self):
    """Fetch crypto market data from CoinGecko."""
    try:
        snapshot = crypto_service.get_current_snapshot()
        store_crypto_data_in_db(snapshot)
        cache_crypto_dominance_in_redis(snapshot)
    except RateLimitError as exc:
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
```

**Why 2:15 AM UTC?**
- Runs **after** FRED update (2:00 AM UTC) to avoid concurrent API calls
- Low traffic period to minimize user impact
- Stays under CoinGecko's 30 calls/minute rate limit

### Rate Limiting

**CoinGecko Demo Key Limits:**
- **30 calls per minute**
- **365 days max historical data**

**Strategy:**
- Daily scheduled updates (1 call/day)
- No real-time polling (uses cached data)
- Exponential backoff on failures

### Database Schema

```sql
CREATE TABLE crypto_data (
    timestamp TIMESTAMPTZ NOT NULL PRIMARY KEY,
    total_mcap NUMERIC,
    btc_dominance NUMERIC,
    eth_dominance NUMERIC,
    altcoin_mcap NUMERIC
);

-- TimescaleDB hypertable for efficient time-series queries
SELECT create_hypertable('crypto_data', 'timestamp',
    chunk_time_interval => INTERVAL '7 days');

-- Compression for data older than 30 days
ALTER TABLE crypto_data SET (timescaledb.compress);
SELECT add_compression_policy('crypto_data', INTERVAL '30 days');
```

### Frontend Component

**DominanceCard Features:**
- **Stacked Area Chart**: BTC (blue), ETH (purple), OTHERS (green)
- **Real-Time Percentages**: "BTC 45.5% | ETH 17.2% | OTHERS 37.3%"
- **Dominance Bars**: Visual distribution of market cap
- **Statistics Panel**: BTC dominance mean, std dev, min, max
- **Total Market Cap**: Current global crypto market cap
- **Timeframe Selector**: 1D, 1W, 1M, 3M, 6M, 1Y, YTD, MAX

### Implementation Files

**Backend:**
- [backend/services/crypto.py](../backend/services/crypto.py) - CoinGecko client and service
- [backend/routers/crypto.py](../backend/routers/crypto.py) - API endpoint
- [backend/tasks/crypto_tasks.py](../backend/tasks/crypto_tasks.py) - Background worker

**Frontend:**
- [web/src/components/macro/dominance-card.tsx](../web/src/components/macro/dominance-card.tsx) - Chart component
- [web/src/hooks/use-data.ts](../web/src/hooks/use-data.ts) - React Query hook

### Usage Scenarios

| Dominance Pattern | Market Regime | Trading Implication |
|-------------------|---------------|---------------------|
| **BTC ↑, ETH ↓, OTHERS ↓** | Risk-off, deleveraging | Hold cash, exit altcoins |
| **BTC ↓, ETH ↑, OTHERS ↑** | **Alt-Season starting** | Rotate into alts |
| **BTC ↓, ETH ↓, OTHERS ↑** | **Peak Alt-Season** | Take profits on alts |
| **BTC ↑, ETH ↑, OTHERS ↓** | Recovery phase | Accumulate BTC/ETH |

---

## Barbell Strategy Tracker

### Overview

The **Barbell Strategy** balances portfolio exposure between **safe assets** (gold, bonds) and **risk assets** (stocks, crypto) while minimizing middle-ground holdings. This feature tracks the ratio of Safe vs. Risk allocations to optimize for tail-risk protection + upside participation.

### Concept

**Barbell Portfolio Structure:**
- **80-90% Safe**: Gold, Treasury bonds, cash
- **10-20% Risk**: High-volatility growth stocks, crypto, venture capital
- **0% Middle**: Avoid "moderately safe" assets that offer neither protection nor upside

**Goal:** Survive worst-case scenarios while capturing exponential upside.

### Implementation Status

**Current Status:** Planned (not yet implemented)

**Proposed Data Sources:**
- **Safe Assets**: GLD (gold ETF), TLT (long-term treasuries), SHV (short-term treasuries)
- **Risk Assets**: SPY (stocks), BTC (crypto), QQQ (tech)

**Proposed Metrics:**
- **Safe/Risk Ratio**: Current allocation percentage
- **Volatility Drag**: How much safe assets reduce portfolio volatility
- **Tail Risk Coverage**: Safe asset percentage needed for X% drawdown protection

### Proposed API Endpoint

```
GET /api/risk/barbell
```

**Response:**

```json
{
  "safe_assets": {
    "allocation_percent": 85,
    "holdings": [
      { "ticker": "GLD", "weight": 40 },
      { "ticker": "TLT", "weight": 30 },
      { "ticker": "SHV", "weight": 15 }
    ]
  },
  "risk_assets": {
    "allocation_percent": 15,
    "holdings": [
      { "ticker": "BTC", "weight": 8 },
      { "ticker": "SPY", "weight": 5 },
      { "ticker": "QQQ", "weight": 2 }
    ]
  },
  "metrics": {
    "volatility_reduction": 65,
    "tail_risk_coverage": 90
  }
}
```

---

## Log-Regression Risk Bands

### Overview

**Log-Regression Risk Bands** model Bitcoin's long-term price trend using a **power law relationship** between price and time. This creates dynamic support/resistance bands to identify overvalued ("risk-off") and undervalued ("risk-on") periods.

### Mathematical Foundation

**Power Law Regression:**

```
log(Price) = a × log(Days Since Genesis) + b

Equivalent to:
Price = exp(b) × (Days Since Genesis)^a
```

**Why Log-Log?**
- Bitcoin's growth is exponential (not linear)
- Log transformation linearizes the relationship
- Residuals show deviation from long-term trend

### Implementation Status

**Current Status:** Planned (not yet implemented)

**Proposed Data Sources:**
- **Historical BTC Price**: CoinGecko API
- **Genesis Date**: January 3, 2009 (Bitcoin block 0)

**Proposed Bands:**
- **Upper Band**: +2 standard deviations (risk-off zone)
- **Fair Value**: Regression line (neutral)
- **Lower Band**: -2 standard deviations (risk-on zone)

### Proposed Calculation

```typescript
// 1. Calculate days since genesis for each data point
const genesisDays = daysSince('2009-01-03', dataPoint.date);

// 2. Perform linear regression on log-log data
const logDays = Math.log(genesisDays);
const logPrice = Math.log(dataPoint.price);
const { slope, intercept } = linearRegression(logDays, logPrice);

// 3. Calculate fair value and bands
const fairValue = Math.exp(intercept + slope × logDays);
const upperBand = fairValue × Math.exp(2 × stdDev);
const lowerBand = fairValue × Math.exp(-2 × stdDev);
```

### Proposed Visualization

**Chart Type:** Line chart with shaded bands
- **Green Zone**: Below lower band (undervalued, risk-on)
- **Yellow Zone**: Between bands (neutral)
- **Red Zone**: Above upper band (overvalued, risk-off)

### Related Research

- **Plan B's Stock-to-Flow Model**: Uses scarcity (stock/flow) instead of time
- **Bitcoin Rainbow Chart**: Color-coded log-regression bands
- **Power Law Corridor**: Similar concept with different coefficients

---

## Feature Configuration

### Environment Variables

```bash
# Required for all features
FRED_API_KEY=your_fred_api_key
COINGECKO_API_KEY=your_coingecko_api_key

# Optional: Feature flags
ENABLE_M2_CPI_TOGGLE=true
ENABLE_CRYPTO_DOMINANCE=true
ENABLE_BARBELL_TRACKER=false  # Not yet implemented
ENABLE_LOG_REGRESSION=false   # Not yet implemented
```

### Frontend Feature Toggles

**Session Storage Persistence (Planned):**

```typescript
// Remember M2 CPI toggle state across page reloads
const [adjustForInflation, setAdjustForInflation] = React.useState(() => {
  const saved = sessionStorage.getItem('m2-cpi-adjusted');
  return saved === 'true';
});

React.useEffect(() => {
  sessionStorage.setItem('m2-cpi-adjusted', String(adjustForInflation));
}, [adjustForInflation]);
```

---

## Testing

### M2 Purchasing Power Toggle

**Unit Tests:**

```bash
cd web
npm test series-utils
```

**Manual Tests:**
- [ ] Toggle on: chart updates instantly
- [ ] Toggle off: reverts to nominal values
- [ ] First visible point = 100 when adjusted
- [ ] Subtitle shows "Purchasing power (CPI-adjusted, indexed to 100)"
- [ ] Y-axis formatter shows index values (no $ sign)

### Crypto Dominance Chart

**Backend Tests:**

```bash
# Test CoinGecko API client
python -c "
from backend.services.crypto import CoinGeckoClient
client = CoinGeckoClient()
print(client.get_global())
"

# Test Celery worker
celery -A backend.celery_app call backend.tasks.crypto_tasks.update_crypto_metrics
```

**Frontend Tests:**

```bash
# Check API endpoint
curl http://localhost:8000/api/crypto/dominance?days=30

# Visual inspection
npm run dev
# Navigate to http://localhost:3000 and check DominanceCard
```

---

## Related Documentation

- **[Technical Architecture](TECHNICAL_ARCHITECTURE.md)** - System design, database schema, worker architecture
- **[Developer Setup](DEVELOPER_SETUP.md)** - Local environment configuration
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment procedures
- **[Verification Guide](VERIFICATION.md)** - Testing and health check procedures
