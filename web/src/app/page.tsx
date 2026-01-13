"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { useLiquidity, useDebtStatus, useRealRates } from "@/hooks/use-data";
import { SyncedAreaChart } from "@/components/charts/synced-chart";
import {
  ExpandableChartCard,
  ChartGridProvider,
} from "@/components/charts/expandable-chart-card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// Format helpers
function formatLargeNumber(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toFixed(2)}`;
}

function formatDate(dateInput: string | number): string {
  const date = new Date(dateInput);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

// Liquidity (M2) Chart Component
function LiquidityCard({ days }: { days?: number }) {
  const { data, isLoading, error } = useLiquidity(days);
  const [adjustForInflation, setAdjustForInflation] = React.useState(false);

  // Use full data from backend (filtered by days)
  const chartData = React.useMemo(() => {
    if (!data) return [];
    return data.map((item) => ({
      ...item,
      date: item.date,
      value: item.value,
      growth_rate: (item.growth_rate ?? 0) * 100, // Convert to percentage, default 0
    }));
  }, [data]);

  const latestValue = chartData.length > 0 ? chartData[0].value : 0;
  const latestGrowth = chartData.length > 0 ? chartData[0].growth_rate : 0;

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/50 bg-card/50 p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">Failed to load M2 data</span>
        </div>
      </div>
    );
  }

  return (
    <ExpandableChartCard
      id="m2-liquidity"
      title="M2 Money Supply"
      subtitle="Federal Reserve monetary aggregate"
      metricValue={formatLargeNumber(latestValue * 1e9)}
      metricChange={latestGrowth}
      changeLabel="YoY"
      variant={latestGrowth > 0 ? "success" : "danger"}
      isLoading={isLoading}
      condensedChart={
        <SyncedAreaChart
          data={chartData}
          xDataKey="date"
          mode="condensed"
          lines={[
            {
              dataKey: "value",
              stroke: "#3b82f6",
              name: "M2 (Billions)",
            },
          ]}
          height={80}
        />
      }
      detailedChart={
        <SyncedAreaChart
          data={chartData}
          xDataKey="date"
          syncId="macro-charts-modal"
          mode="detailed"
          lines={[
            {
              dataKey: "value",
              stroke: "#3b82f6",
              name: "M2 (Billions)",
            },
          ]}
          formatXAxis={formatDate}
          formatYAxis={(v) => `$${(v / 1000).toFixed(0)}T`}
          height={400}
        />
      }
      modalActions={
        <div className="flex items-center space-x-2">
          <Switch
            id="inflation-adjust-m2-modal"
            checked={adjustForInflation}
            onCheckedChange={setAdjustForInflation}
          />
          <Label htmlFor="inflation-adjust-m2-modal" className="text-sm text-muted-foreground cursor-pointer">
            Adjust for CPI
          </Label>
        </div>
      }
    />
  );
}

// Debt Status Card
function DebtStatusCard({ days }: { days?: number }) {
  const { data, isLoading, error } = useDebtStatus(days);

  const chartData = React.useMemo(() => {
    if (!data) return [];
    return data.map((item) => ({
      ...item,
      date: item.date,
    }));
  }, [data]);

  const latestRatio = chartData.length > 0 ? chartData[0].ratio : 0;
  const previousRatio = chartData.length > 1 ? chartData[1].ratio : latestRatio;
  const ratioChange = latestRatio - previousRatio;

  const getVariant = (): "default" | "success" | "warning" | "danger" => {
    if (latestRatio > 30) return "danger";
    if (latestRatio > 20) return "warning";
    return "default";
  };

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/50 bg-card/50 p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">Failed to load debt data</span>
        </div>
      </div>
    );
  }

  return (
    <ExpandableChartCard
      id="debt-status"
      title="Interest-to-Tax Ratio"
      subtitle="Fiscal stress indicator"
      metricValue={`${latestRatio.toFixed(1)}%`}
      metricChange={ratioChange}
      changeLabel="MoM"
      variant={getVariant()}
      isLoading={isLoading}
      condensedChart={
        <SyncedAreaChart
          data={chartData}
          xDataKey="date"
          mode="condensed"
          lines={[
            {
              dataKey: "ratio",
              stroke: "#10b981",
              name: "Ratio (%)",
            },
          ]}
          height={80}
        />
      }
      detailedChart={
        <SyncedAreaChart
          data={chartData}
          xDataKey="date"
          syncId="macro-charts-modal"
          mode="detailed"
          lines={[
            {
              dataKey: "ratio",
              stroke: "#10b981",
              name: "Ratio (%)",
            },
          ]}
          formatXAxis={formatDate}
          formatYAxis={(v) => `${v.toFixed(0)}%`}
          height={400}
        />
      }
    />
  );
}

// Real Rates Card
function RealRatesCard({ days }: { days?: number }) {
  const { data, isLoading, error } = useRealRates();

  const chartData = React.useMemo(() => {
    if (!data) return [];
    // Filter locally if days is provided
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

  const latestRealRate = chartData.length > 0 ? chartData[0].real_rate : 0;
  const previousRealRate = chartData.length > 1 ? chartData[1].real_rate : latestRealRate;
  const rateChange = latestRealRate - previousRealRate;

  const getVariant = (): "default" | "success" | "warning" | "danger" => {
    if (latestRealRate < -1) return "danger";
    if (latestRealRate < 0) return "warning";
    return "success";
  };

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/50 bg-card/50 p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">Failed to load real rates</span>
        </div>
      </div>
    );
  }

  return (
    <ExpandableChartCard
      id="real-rates"
      title="Real Interest Rate"
      subtitle="10Y Treasury minus CPI"
      metricValue={`${latestRealRate.toFixed(2)}%`}
      metricChange={rateChange}
      changeLabel="MoM"
      variant={getVariant()}
      isLoading={isLoading}
      condensedChart={
        <SyncedAreaChart
          data={chartData}
          xDataKey="date"
          mode="condensed"
          lines={[
            {
              dataKey: "real_rate",
              stroke: "#8b5cf6",
              name: "Real Rate (%)",
            },
          ]}
          height={80}
        />
      }
      detailedChart={
        <SyncedAreaChart
          data={chartData}
          xDataKey="date"
          syncId="macro-charts-modal"
          mode="detailed"
          lines={[
            {
              dataKey: "real_rate",
              stroke: "#8b5cf6",
              name: "Real Rate (%)",
            },
          ]}
          formatXAxis={formatDate}
          formatYAxis={(v) => `${v.toFixed(1)}%`}
          height={400}
        />
      }
    />
  );
}

// Main Page Component
export default function MacroWatchtowerPage() {
  const [days, setDays] = React.useState<number | undefined>(undefined);

  return (
    <ChartGridProvider>
      <div className="space-y-6">
        {/* Header with timeframe controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Macro Watchtower</h1>
            <p className="text-muted-foreground mt-1">
              Monitor systemic risks and macroeconomic indicators
            </p>
          </div>
          <div className="flex gap-2">
            {[
              { label: "1Y", value: 365 },
              { label: "5Y", value: 1825 },
              { label: "10Y", value: 3650 },
              { label: "MAX", value: undefined },
            ].map(({ label, value }) => (
              <Button
                key={label}
                variant={days === value ? "default" : "outline"}
                size="sm"
                onClick={() => setDays(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* High-Density Grid of Expandable Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <LiquidityCard days={days} />
          <DebtStatusCard days={days} />
          <RealRatesCard days={days} />
        </div>
      </div>
    </ChartGridProvider>
  );
}
