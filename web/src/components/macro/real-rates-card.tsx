"use client";

import * as React from "react";
import { useRealRates } from "@/hooks/use-data";
import { useRealRatesPrefs } from "@/stores/macro-preferences";
import { MacroMetricCard } from "./macro-metric-card";

// Real Rates Card
export function RealRatesCard({ days }: { days?: number }) {
  const { data, isLoading, error } = useRealRates();
  
  // Get preferences from Zustand store (persisted)
  const {
    timeframe,
    setTimeframe,
    showSMA,
    logScale,
    setPrefs,
  } = useRealRatesPrefs();

  const chartData = React.useMemo(() => {
    if (!data) return [];
    // Filter locally if days is provided (for grid view)
    let processed = data;
    if (days) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      processed = data.filter((d) => new Date(d.date) >= cutoff);
    }
    return processed.map((item) => ({
      ...item,
      date: item.date,
    }));
  }, [data, days]);

  // Full data for modal (ignoring grid-level 'days' prop for full history)
  const fullData = React.useMemo(() => {
    if (!data) return [];
    return data.map((item) => ({
      ...item,
      date: item.date,
    }));
  }, [data]);

  return (
    <MacroMetricCard
      id="real-rates"
      title="Real Interest Rate"
      subtitle="10Y Treasury minus CPI"
      data={fullData}
      isLoading={isLoading}
      error={error}
      valueKey="real_rate"
      chartColor="#8b5cf6"
      seriesType="Line"
      timeframe={timeframe}
      setTimeframe={setTimeframe}
      showSMA={showSMA}
      logScale={logScale}
      setPrefs={setPrefs}
      smaWindow={50}
      smaLabel="SMA 50"
      metricFormatter={(value) => `${value.toFixed(2)}%`}
      getLatestValue={(data) => chartData[0]?.real_rate ?? 0}
      getMetricChange={(data) => {
        const latest = chartData[0]?.real_rate ?? 0;
        const previous = chartData[1]?.real_rate ?? latest;
        return latest - previous;
      }}
      getChangeLabel={() => "MoM"}
      getVariant={(latestValue) => {
        if (latestValue < -1) return "danger";
        if (latestValue < 0) return "warning";
        return "success";
      }}
      sidebarTitle="Rate Analysis"
    />
  );
}
