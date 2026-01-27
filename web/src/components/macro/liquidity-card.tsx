"use client";

import * as React from "react";
import { useLiquidity, useCpi } from "@/hooks/use-data";
import { PurchasingPowerToggle } from "@/components/charts/chart-controls";
import { formatLargeNumber } from "@/lib/formatters";
import { adjustSeriesByCPI, type SeriesPoint } from "@/lib/series-utils";
import { useLiquidityPrefs } from "@/stores/macro-preferences";
import { MacroMetricCard } from "./macro-metric-card";

// Liquidity (M2) Chart Component
export function LiquidityCard({ days }: { days?: number }) {
  const { data, isLoading, error } = useLiquidity(days);
  
  // Get preferences from Zustand store (persisted)
  const {
    timeframe,
    setTimeframe,
    showSMA,
    showEMA,
    logScale,
    adjustForInflation,
    setPrefs,
  } = useLiquidityPrefs();

  // Fetch CPI data when adjustment is enabled
  const { data: cpiData, isLoading: cpiLoading } = useCpi(adjustForInflation ? days : undefined);

  // Process data
  const processedData = React.useMemo(() => {
    if (!data) return [];
    return data.map((item) => ({
      ...item,
      date: item.date,
      value: item.value,
      growth_rate: (item.growth_rate ?? 0) * 100,
    }));
  }, [data]);

  // Get the first date for the footer message
  const firstDate = processedData.length > 0 ? processedData[0].date : null;

  return (
    <MacroMetricCard
      id="m2-liquidity"
      title="M2 Money Supply"
      subtitle={adjustForInflation ? "Purchasing power (CPI-adjusted, indexed to 100)" : "Federal Reserve monetary aggregate"}
      data={processedData}
      isLoading={isLoading}
      error={error}
      valueKey="value"
      adjustmentData={cpiData}
      chartColor="#3b82f6"
      seriesType="Area"
      timeframe={timeframe}
      setTimeframe={setTimeframe}
      showSMA={showSMA}
      showEMA={showEMA}
      logScale={logScale}
      adjustForInflation={adjustForInflation}
      setPrefs={setPrefs}
      smaWindow={20}
      emaWindow={20}
      metricFormatter={(value, adjusted) => 
        adjusted ? value.toFixed(1) : formatLargeNumber(value * 1e9)
      }
      chartFormatter={(price, adjusted) => {
        if (adjusted) {
          return price.toFixed(1);
        }
        if (price >= 1000) return `$${(price / 1000).toFixed(2)}T`;
        return `$${price.toFixed(0)}B`;
      }}
      getLatestValue={(data) => data[0]?.value ?? 0}
      getMetricChange={(data) => data[0]?.growth_rate ?? 0}
      getChangeLabel={() => "YoY"}
      getVariant={(latestValue, change) => change > 0 ? "success" : "danger"}
      adjustDataForInflation={(data, cpiData) => {
        const m2Series: SeriesPoint[] = data.map(d => ({ date: d.date, value: d.value }));
        const cpiSeries: SeriesPoint[] = cpiData.map(d => ({ date: d.date, value: d.value }));
        const adjustedSeries = adjustSeriesByCPI(m2Series, cpiSeries, true, true);
        
        return data
          .map(item => {
            const adjusted = adjustedSeries.find(a => a.date === item.date);
            if (adjusted) {
              return { ...item, value: adjusted.value };
            }
            return null;
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);
      }}
      additionalActions={
        <>
          <div className="h-6 w-px bg-border/50" />
          <PurchasingPowerToggle
            checked={adjustForInflation}
            onChange={(v) => setPrefs({ adjustForInflation: v })}
            type="CPI"
            disabled={cpiLoading}
          />
        </>
      }
      detailedFooter={
        adjustForInflation && firstDate ? (
          <p className="text-xs text-muted-foreground text-center">
            Indexed to 100 at {new Date(firstDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        ) : undefined
      }
      sidebarTitle={adjustForInflation ? "Real M2 Analysis (CPI-Adj)" : "Liquidity Analysis"}
    />
  );
}
