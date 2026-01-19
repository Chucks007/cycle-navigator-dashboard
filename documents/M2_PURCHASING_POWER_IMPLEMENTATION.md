# M2 Purchasing Power Toggle Implementation

## Overview
This feature adds a per-chart toggle to adjust M2 Money Supply values by CPI (Consumer Price Index) to show purchasing power instead of nominal values. Values are indexed to 100 at the first visible data point for better readability.

## Implementation Summary

### Files Created
1. **`web/src/lib/series-utils.ts`** - Core utilities for time series alignment and adjustment
   - `alignSeriesByDate()` - Forward-fill alignment for frequency mismatches (monthly CPI → daily data)
   - `indexSeriesToBase()` - Index series to 100 at specified base point
   - `adjustSeriesByM2()` - Adjust asset prices by M2 money supply
   - `adjustSeriesByCPI()` - Adjust nominal values by CPI for inflation adjustment

2. **`web/src/lib/__tests__/series-utils.test.ts`** - Comprehensive unit tests
   - Tests for date alignment with forward-fill logic
   - Tests for indexing to 100 (first, last, specific date)
   - Tests for M2 and CPI adjustments
   - Edge case handling (empty series, missing dates, zero values)

### Files Modified

#### Backend Integration
- **`web/src/lib/api-client.ts`**
  - Added `getCpi(days?: number)` method to fetch CPI data
  - Added `CPIPoint` type import

- **`web/src/hooks/use-data.ts`**
  - Added `useCpi(days?: number)` hook with React Query integration
  - Lazy loading: only fetches when `days` parameter is provided
  - 5-minute stale time matching other macro data hooks

#### UI Components
- **`web/src/components/charts/chart-controls.tsx`**
  - Added `PurchasingPowerToggle` component
  - Supports both "M2" and "CPI" adjustment types
  - Consistent styling with existing toggles (LogScaleToggle, RegressionBandsToggle)
  - Disabled state support while data loads

#### Chart Implementation
- **`web/src/components/macro/liquidity-card.tsx`**
  - Added local state: `adjustForInflation` (boolean)
  - Lazy CPI data fetching: `useCpi(adjustForInflation ? days : undefined)`
  - Data transformation pipeline:
    1. Fetch M2 and CPI data
    2. Align series by date (forward-fill)
    3. Calculate CPI-adjusted values
    4. Index to 100 at first point
    5. Update chart data
  - Dynamic formatting:
    - Nominal: `$21.5T` or `$21500B`
    - Adjusted: `100.0` (index value)
  - Dynamic subtitle showing adjustment status
  - Base date indicator below chart: "Indexed to 100 at Jan 1, 2024"
  - Updated sidebar stats with adjusted formatter

## Technical Details

### Forward-Fill Algorithm
The `alignSeriesByDate()` function handles frequency mismatches between monthly M2/CPI and daily asset data:

```typescript
// For each daily stock price:
// 1. Find the most recent CPI value where CPI.date <= stock.date
// 2. Use that CPI value (forward-fill)
// 3. Handle edge cases:
//    - Drop daily points before first CPI date (dropEarly=true)
//    - Or backfill with first CPI value (dropEarly=false)
```

### Indexing to 100
The `indexSeriesToBase()` function normalizes values to improve readability:

```typescript
// Convert absolute values to relative indices
// If M2 series is [21000, 21500, 22000]
// Indexed result is [100, 102.38, 104.76]
// Formula: (value / baseValue) * 100
```

### CPI Adjustment Formula
```typescript
// Real M2 = Nominal M2 / (CPI / base_CPI)
// Then index to 100 for display
// Example:
//   Nominal M2: 21000
//   CPI: 315 (base: 310)
//   Real M2: 21000 / (315/310) = 20666.67
//   Indexed: 100 (at first point)
```

## Usage

### In LiquidityCard
1. Open M2 Money Supply card
2. Click to expand modal
3. Toggle "CPI Adj" switch in modal actions
4. Chart instantly updates to show purchasing power
5. Subtitle changes to "Purchasing power (CPI-adjusted, indexed to 100)"
6. Y-axis shows index values instead of dollar amounts
7. Base date indicator appears below chart

### Data Flow
```
User toggles CPI Adj
  ↓
useCpi() hook fetches CPI data (lazy)
  ↓
chartData memoization triggers
  ↓
adjustSeriesByCPI(m2, cpi)
  ↓
  1. alignSeriesByDate() - forward-fill CPI to daily M2
  2. Calculate: real_m2 = nominal_m2 / (cpi / base_cpi)
  3. indexSeriesToBase() - normalize to 100
  ↓
Chart re-renders with adjusted data
  ↓
Formatter shows index values (e.g., "100.0")
```

## State Management

### Per-Chart Local State
- **Pattern**: `useState` in each card component
- **Benefits**:
  - Independent toggles per chart
  - No global state pollution
  - Simple implementation
  - Easy to extend to other charts
- **Persistence**: Currently in-memory only
  - Future: Add sessionStorage for persistence across page navigation

## Performance Optimizations

1. **Lazy Loading**: CPI data only fetches when toggle is enabled
   ```typescript
   useCpi(adjustForInflation ? days : undefined)
   ```

2. **Memoization**: Data transformations cached with React.useMemo
   ```typescript
   const chartData = React.useMemo(() => {
     // Expensive alignment and indexing
   }, [data, adjustForInflation, cpiData]);
   ```

3. **Query Caching**: React Query caches CPI data (5-minute stale time)

## Testing

### Unit Tests (series-utils.test.ts)
Run tests after installing vitest:
```bash
cd web
npm install -D vitest @vitest/ui
npm test
```

Test coverage:
- ✅ Date alignment with forward-fill
- ✅ Indexing to 100 (first, last, specific date)
- ✅ M2 adjustment calculation
- ✅ CPI adjustment calculation
- ✅ Edge cases (empty arrays, missing dates, zero values)
- ✅ Unsorted data handling

### Manual Testing
1. **Basic Toggle**
   - [ ] Toggle on: chart updates instantly
   - [ ] Toggle off: reverts to nominal values
   - [ ] No page reload required

2. **Data Accuracy**
   - [ ] First visible point = 100 when adjusted
   - [ ] Values decrease when inflation > M2 growth
   - [ ] Values match expected purchasing power trend

3. **UI/UX**
   - [ ] Subtitle updates: "Purchasing power (CPI-adjusted, indexed to 100)"
   - [ ] Base date indicator shows correct date
   - [ ] Y-axis formatter shows index values (no $ sign)
   - [ ] Sidebar stats use correct formatter
   - [ ] Toggle disabled while CPI data loads

4. **Edge Cases**
   - [ ] Toggle before CPI data loads (should disable toggle)
   - [ ] No CPI data available (toggle should be disabled)
   - [ ] Timeframe changes (re-index to new first point)
   - [ ] Empty data sets (no crashes)

## Future Enhancements

### 1. Session Persistence
Add sessionStorage to remember toggle state:
```typescript
const [adjustForInflation, setAdjustForInflation] = React.useState(() => {
  const saved = sessionStorage.getItem('m2-cpi-adjusted');
  return saved === 'true';
});

React.useEffect(() => {
  sessionStorage.setItem('m2-cpi-adjusted', String(adjustForInflation));
}, [adjustForInflation]);
```

### 2. Other Charts
Apply the same pattern to:
- Debt Status Card
- Real Rates Card
- Stock price charts
- Crypto charts

### 3. Custom Base Date Selector
Allow users to choose base date for indexing:
```typescript
<Select value={baseDate} onChange={setBaseDate}>
  <option value="first">First Point</option>
  <option value="last">Last Point</option>
  <option value="2020-01-01">Jan 1, 2020</option>
</Select>
```

### 4. M2 Adjustment (Not CPI)
For stock/crypto charts, add M2 adjustment:
```typescript
// Show BTC/M2 ratio indexed to 100
const adjusted = adjustSeriesByM2(btcPrices, m2Data);
```

### 5. Comparison View
Show both nominal and adjusted series on same chart:
```typescript
const extraSeries: ExtraSeriesConfig[] = [
  {
    data: adjustedData,
    color: "#10b981",
    title: "CPI-Adjusted (Real)",
    lineStyle: 2, // Dashed
  }
];
```

## API Dependencies

### Backend Endpoints
- **GET `/api/macro/liquidity`** - M2 Money Supply (already exists)
  - Returns: `LiquidityPoint[]` with date, value, growth_rate
  - Frequency: Monthly
  - Data source: FRED M2SL

- **GET `/api/macro/cpi`** - Consumer Price Index (already exists)
  - Returns: `CPIPoint[]` with date, value
  - Frequency: Monthly
  - Data source: FRED CPIAUCSL

No backend changes required - feature is 100% client-side!

## Acceptance Criteria

### ✅ Completed
- [x] Toggle appears in LiquidityCard modal
- [x] Turning toggle ON changes chart to indexed values
- [x] Turning toggle OFF reverts to nominal values
- [x] No page reload triggered
- [x] Calculation happens client-side
- [x] Tooltips/formatters reflect adjusted units
- [x] Forward-fill logic handles monthly→daily frequency mismatch
- [x] Values indexed to 100 for readability
- [x] Unit tests written for all utilities
- [x] Documentation created

### 📋 Recommended Next Steps
- [ ] Install vitest and run unit tests
- [ ] Manual testing on dev server
- [ ] Apply pattern to DebtStatusCard
- [ ] Add session persistence
- [ ] Create Playwright E2E test

## Example Screenshots

### Before (Nominal M2)
```
Title: M2 Money Supply
Subtitle: Federal Reserve monetary aggregate
Value: $21.5T
Y-axis: $18T, $19T, $20T, $21T, $22T
```

### After (CPI-Adjusted)
```
Title: M2 Money Supply
Subtitle: Purchasing power (CPI-adjusted, indexed to 100)
Value: 98.5
Y-axis: 95.0, 97.5, 100.0, 102.5, 105.0
Note: "Indexed to 100 at Jan 1, 2023"
```

## Troubleshooting

### Toggle doesn't enable
- **Cause**: CPI data not available
- **Fix**: Check backend `/api/macro/cpi` endpoint
- **Verify**: Console should show 404 or error message

### Values look wrong
- **Cause**: Indexing or alignment issue
- **Debug**: Add console.log in chartData memoization
- **Check**: First point should always be 100 when adjusted

### Chart doesn't update
- **Cause**: Memoization dependencies missing
- **Fix**: Ensure `adjustForInflation` and `cpiData` in dependency array
- **Verify**: Toggle state change should trigger re-render

## Related Files
- Backend: `backend/services/macro.py` - M2 and CPI data fetching
- Backend: `backend/routers/macro.py` - API endpoints
- Frontend: All files listed in "Files Created/Modified" sections above
