"use client";

import * as React from "react";
import { useDebtStatus } from "@/hooks/use-macro-data";
import { useDebtStatusPrefs } from "@/stores/macro-preferences";
import { MacroMetricCard } from "./macro-metric-card";

// Debt Status Card
export function DebtStatusCard({ days }: { days?: number }) {
  const { data, isLoading, error } = useDebtStatus(days);
  
  // Get preferences from Zustand store (persisted)
  const {
    timeframe,
    setTimeframe,
    showSMA,
    logScale,
    setPrefs,
  } = useDebtStatusPrefs();
  
  const chartData = React.useMemo(() => {
    if (!data) return [];
    return data.map((item) => ({
      ...item,
      date: item.date,
    }));
  }, [data]);

  return (
    <MacroMetricCard
      id="debt-status"
      title="Interest-to-Tax Ratio"
      subtitle="Fiscal stress indicator"
      data={chartData}
      isLoading={isLoading}
      error={error}
      valueKey="ratio"
      chartColor="#10b981"
      seriesType="Line"
      timeframe={timeframe}
      setTimeframe={setTimeframe}
      showSMA={showSMA}
      logScale={logScale}
      setPrefs={setPrefs}
      smaWindow={20}
      metricFormatter={(value) => `${value.toFixed(1)}%`}
      getLatestValue={(data) => data[0]?.ratio ?? 0}
      getMetricChange={(data) => {
        const latest = data[0]?.ratio ?? 0;
        const previous = data[1]?.ratio ?? latest;
        return latest - previous;
      }}
      getChangeLabel={() => "MoM"}
      getVariant={(latestValue) => {
        if (latestValue > 30) return "danger";
        if (latestValue > 20) return "warning";
        return "default";
      }}
      sidebarTitle="Debt Analysis"
    />
  );
}
