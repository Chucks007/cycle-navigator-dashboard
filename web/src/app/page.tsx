"use client";

import * as React from "react";
import { Activity, DollarSign, Percent, AlertTriangle } from "lucide-react";
import { useLiquidity, useDebtStatus, useRealRates } from "@/hooks/use-data";
import { MetricCard, MetricCardSkeleton } from "@/components/ui/metric-card";
import {
  ChartContainer,
  SyncedAreaChart,
  ChartSkeleton,
} from "@/components/charts/synced-chart";
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
function LiquiditySection({ days }: { days?: number }) {
  const { data, isLoading, error } = useLiquidity(days);
  const [adjustForInflation, setAdjustForInflation] = React.useState(false);

  if (error) {
    return (
      <ChartContainer title="M2 Money Supply" className="col-span-full">
        <div className="flex items-center justify-center h-[300px] text-destructive">
          <AlertTriangle className="mr-2 h-5 w-5" />
          Failed to load liquidity data
        </div>
      </ChartContainer>
    );
  }

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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              title="M2 Money Supply"
              value={formatLargeNumber(latestValue * 1e9)}
              subtitle="Total liquidity in the system"
              icon={<DollarSign className="h-4 w-4" />}
              change={latestGrowth}
              changeLabel="YoY"
              variant={latestGrowth > 0 ? "success" : "danger"}
            />
            <MetricCard
              title="YoY Growth Rate"
              value={`${latestGrowth.toFixed(2)}%`}
              subtitle="Money supply expansion"
              icon={<Activity className="h-4 w-4" />}
              variant={latestGrowth > 5 ? "warning" : "default"}
            />
          </>
        )}
      </div>

      <ChartContainer
        title="M2 Money Supply Trend"
        subtitle="Federal Reserve monetary aggregate"
        actions={
          <div className="flex items-center space-x-2">
            <Switch
              id="inflation-adjust-m2"
              checked={adjustForInflation}
              onCheckedChange={setAdjustForInflation}
            />
            <Label htmlFor="inflation-adjust-m2" className="text-sm text-muted-foreground cursor-pointer">
              Adjust for CPI
            </Label>
          </div>
        }
      >
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <SyncedAreaChart
            data={chartData}
            xDataKey="date"
            syncId="macro-charts"
            lines={[
              {
                dataKey: "value",
                stroke: "#3b82f6",
                name: "M2 (Billions)",
              },
            ]}
            formatXAxis={formatDate}
            formatYAxis={(v) => `$${(v / 1000).toFixed(0)}T`}
            height={300}
          />
        )}
      </ChartContainer>
    </div>
  );
}

// Debt Status Section
function DebtStatusSection({ days }: { days?: number }) {
  const { data, isLoading, error } = useDebtStatus(days);

  if (error) {
    return (
      <ChartContainer title="Interest-to-Tax Ratio" className="col-span-full">
        <div className="flex items-center justify-center h-[300px] text-destructive">
          <AlertTriangle className="mr-2 h-5 w-5" />
          Failed to load debt status data
        </div>
      </ChartContainer>
    );
  }

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

  const getVariant = () => {
    if (latestRatio > 30) return "danger";
    if (latestRatio > 20) return "warning";
    return "default";
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <MetricCardSkeleton />
        ) : (
          <MetricCard
            title="Interest-to-Tax Ratio"
            value={`${latestRatio.toFixed(1)}%`}
            subtitle="Fiscal stress indicator"
            icon={<Percent className="h-4 w-4" />}
            change={ratioChange}
            changeLabel="MoM"
            variant={getVariant()}
          />
        )}
      </div>

      <ChartContainer
        title="Interest Payments vs Tax Receipts"
        subtitle="Ratio indicates fiscal sustainability"
      >
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <SyncedAreaChart
            data={chartData}
            xDataKey="date"
            syncId="macro-charts"
            lines={[
              {
                dataKey: "ratio",
                stroke: "#10b981",
                name: "Ratio (%)",
              },
            ]}
            formatXAxis={formatDate}
            formatYAxis={(v) => `${v.toFixed(0)}%`}
            height={300}
          />
        )}
      </ChartContainer>
    </div>
  );
}

// Real Rates Section
function RealRatesSection({ days }: { days?: number }) {
  const { data, isLoading, error } = useRealRates(); // Real rates hook doesn't support days yet?

  if (error) {
    return (
      <ChartContainer title="Real Interest Rates" className="col-span-full">
        <div className="flex items-center justify-center h-[300px] text-destructive">
          <AlertTriangle className="mr-2 h-5 w-5" />
          Failed to load real rates data
        </div>
      </ChartContainer>
    );
  }

  const chartData = React.useMemo(() => {
    if (!data) return [];
    // If backend doesn't support days for real rates, we might need manual slice,
    // but better to assuming consistent backend updates.
    // For now we slice locally if 'days' is provided approximate or just show all/120.
    // The previous code had .slice(-120). 
    // If days is provided, we can filter locally.
    let processed = data;
    if (days) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        processed = data.filter(d => new Date(d.date) >= cutoff);
    } 
    
    return processed.map((item) => ({
      ...item,
      date: item.date,
    }));
  }, [data, days]);

  const latestRealRate = chartData.length > 0 ? chartData[0].real_rate : 0;
  const previousRealRate = chartData.length > 1 ? chartData[1].real_rate : latestRealRate;
  const rateChange = latestRealRate - previousRealRate;

  const getVariant = () => {
    if (latestRealRate < -1) return "danger";
    if (latestRealRate < 0) return "warning";
    return "success";
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <MetricCardSkeleton />
        ) : (
          <MetricCard
            title="Real Interest Rate"
            value={`${latestRealRate.toFixed(2)}%`}
            subtitle="10Y Treasury minus CPI"
            icon={<Activity className="h-4 w-4" />}
            change={rateChange}
            changeLabel="MoM"
            variant={getVariant()}
          />
        )}
      </div>

      <ChartContainer
        title="Real Interest Rate Trend"
        subtitle="Negative = Financial repression"
      >
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <SyncedAreaChart
            data={chartData}
            xDataKey="date"
            syncId="macro-charts"
            lines={[
              {
                dataKey: "real_rate",
                stroke: "#8b5cf6",
                name: "Real Rate (%)",
              },
            ]}
            formatXAxis={formatDate}
            formatYAxis={(v) => `${v.toFixed(1)}%`}
            height={300}
          />
        )}
      </ChartContainer>
    </div>
  );
}

// Main Page Component
export default function MacroWatchtowerPage() {
  const [days, setDays] = React.useState<number | undefined>(undefined);

  return (
    <div className="space-y-8">
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

      <LiquiditySection days={days} />
      <DebtStatusSection days={days} />
      <RealRatesSection days={days} />
    </div>
  );
}
