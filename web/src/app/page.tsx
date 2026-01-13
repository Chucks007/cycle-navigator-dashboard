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
import { calculateSMA, calculateEMA, getFinancialStats } from "@/lib/financial-math";
import { TimeframeSelector, IndicatorToggle, type Timeframe } from "@/components/charts/chart-controls";

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

// Helper to filter data by timeframe
const filterByTimeframe = <T extends { date: string | number }>(data: T[], timeframe: Timeframe): T[] => {
  if (timeframe === "ALL") return data;
  
  const now = new Date();
  const cutoff = new Date();
  
  switch(timeframe) {
    case "1M": cutoff.setMonth(now.getMonth() - 1); break;
    case "6M": cutoff.setMonth(now.getMonth() - 6); break;
    case "1Y": cutoff.setFullYear(now.getFullYear() - 1); break;
    case "5Y": cutoff.setFullYear(now.getFullYear() - 5); break;
  }
  
  return data.filter(item => new Date(item.date) >= cutoff);
}

// Reusable Metric Summary Component
function MetricSummarySidebar({ 
  stats, 
  title,
  formatter = (v: number) => v.toFixed(2)
}: { 
  stats: { min: number; max: number; current: number; avg: number };
  title: string;
  formatter?: (v: number) => string;
}) {
  return (
    <div className="space-y-4 text-sm">
      <h4 className="font-semibold text-muted-foreground uppercase tracking-wider text-xs">{title} Stats</h4>
      <div className="space-y-3">
        <div className="flex justify-between items-center p-2 bg-muted/20 rounded">
          <span className="text-muted-foreground">Current</span>
          <span className="font-mono font-medium">{formatter(stats.current)}</span>
        </div>
        <div className="flex justify-between items-center p-2 rounded">
          <span className="text-muted-foreground">All-Time High</span>
          <span className="font-mono font-medium text-green-500">{formatter(stats.max)}</span>
        </div>
        <div className="flex justify-between items-center p-2 rounded">
          <span className="text-muted-foreground">All-Time Low</span>
          <span className="font-mono font-medium text-red-500">{formatter(stats.min)}</span>
        </div>
        <div className="flex justify-between items-center p-2 rounded">
          <span className="text-muted-foreground">Average</span>
          <span className="font-mono font-medium">{formatter(stats.avg)}</span>
        </div>
      </div>
    </div>
  );
}

// Liquidity (M2) Chart Component
function LiquidityCard({ days }: { days?: number }) {
  const { data, isLoading, error } = useLiquidity(days);
  const [adjustForInflation, setAdjustForInflation] = React.useState(false);
  
  // Local state for modal
  const [timeframe, setTimeframe] = React.useState<Timeframe>("1Y");
  const [showSMA, setShowSMA] = React.useState(false);
  const [showEMA, setShowEMA] = React.useState(false);

  // Use full data from backend (filtered by days)
  const chartData = React.useMemo(() => {
    if (!data) return [];
    const mapped = data.map((item) => ({
      ...item,
      date: item.date,
      value: item.value,
      growth_rate: (item.growth_rate ?? 0) * 100,
    }));
    return mapped;
  }, [data]);

  // Derived data for detailed view (Filtered by local timeframe + Indicators)
  const detailedData = React.useMemo(() => {
    const filtered = filterByTimeframe(chartData, timeframe);
    
    // Calculate indicators on filtered data
    const values = filtered.map(d => d.value);
    const sma = calculateSMA(values, 20); // 20-period SMA
    const ema = calculateEMA(values, 20); // 20-period EMA
    
    return filtered.map((d, i) => ({
      ...d,
      sma: sma[i],
      ema: ema[i]
    }));
  }, [chartData, timeframe]);

  // Stats for the sidebar
  const stats = React.useMemo(() => {
    const values = detailedData.map(d => d.value);
    return getFinancialStats(values);
  }, [detailedData]);

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

  // Define chart lines for detailed view
  const detailedLines = [
    { dataKey: "value", stroke: "#3b82f6", name: "M2 (Billions)" },
    ...(showSMA ? [{ dataKey: "sma", stroke: "#fbbf24", name: "SMA (20)" }] : []),
    ...(showEMA ? [{ dataKey: "ema", stroke: "#8b5cf6", name: "EMA (20)" }] : [])
  ];

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
          data={detailedData}
          xDataKey="date"
          syncId="macro-charts-modal"
          mode="detailed"
          lines={detailedLines}
          formatXAxis={formatDate}
          formatYAxis={(v) => `$${(v / 1000).toFixed(0)}T`}
          height={400}
        />
      }
      modalActions={
        <>
           <div className="flex items-center gap-4">
            <TimeframeSelector value={timeframe} onChange={setTimeframe} />
            <div className="h-6 w-px bg-border/50" />
            <IndicatorToggle label="SMA 20" checked={showSMA} onChange={setShowSMA} color="#fbbf24" />
            <IndicatorToggle label="EMA 20" checked={showEMA} onChange={setShowEMA} color="#8b5cf6" />
           </div>
           
           {/* Original switch kept separate if needed, or merged */}
           <div className="flex items-center space-x-2">
            <Switch
              id="inflation-adjust-m2-modal"
              checked={adjustForInflation}
              onCheckedChange={setAdjustForInflation}
            />
            <Label htmlFor="inflation-adjust-m2-modal" className="text-sm text-muted-foreground cursor-pointer">
              CPI Adj
            </Label>
          </div>
        </>
      }
      sidebarContent={
        <MetricSummarySidebar 
          stats={stats} 
          title="Liquidity Analysis" 
          formatter={(v) => formatLargeNumber(v * 1e9)}
        />
      }
    />
  );
}

// Debt Status Card
function DebtStatusCard({ days }: { days?: number }) {
  const { data, isLoading, error } = useDebtStatus(days);
  
  // Local state for modal
  const [timeframe, setTimeframe] = React.useState<Timeframe>("1Y");
  const [showSMA, setShowSMA] = React.useState(false);
  
  const chartData = React.useMemo(() => {
    if (!data) return [];
    return data.map((item) => ({
      ...item,
      date: item.date,
    }));
  }, [data]);

  // Derived detailed data
  const detailedData = React.useMemo(() => {
    const filtered = filterByTimeframe(chartData, timeframe);
    const values = filtered.map(d => d.ratio);
    const sma = calculateSMA(values, 20);
    
    return filtered.map((d, i) => ({
      ...d,
      sma: sma[i]
    }));
  }, [chartData, timeframe]);

  // Stats
  const stats = React.useMemo(() => {
    const values = detailedData.map(d => d.ratio);
    return getFinancialStats(values);
  }, [detailedData]);

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

  const detailedLines = [
    { dataKey: "ratio", stroke: "#10b981", name: "Ratio (%)" },
    ...(showSMA ? [{ dataKey: "sma", stroke: "#fbbf24", name: "SMA (20)" }] : []),
  ];

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
          data={detailedData}
          xDataKey="date"
          syncId="macro-charts-modal"
          mode="detailed"
          lines={detailedLines}
          formatXAxis={formatDate}
          formatYAxis={(v) => `${v.toFixed(0)}%`}
          height={400}
        />
      }
      modalActions={
        <div className="flex items-center gap-4">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
          <div className="h-6 w-px bg-border/50" />
          <IndicatorToggle label="SMA 20" checked={showSMA} onChange={setShowSMA} color="#fbbf24" />
        </div>
      }
      sidebarContent={
        <MetricSummarySidebar 
          stats={stats} 
          title="Debt Analysis"
          formatter={(v) => `${v.toFixed(2)}%`}
        />
      }
    />
  );
}

// Real Rates Card
function RealRatesCard({ days }: { days?: number }) {
  const { data, isLoading, error } = useRealRates();
  
  // Local state for modal
  const [timeframe, setTimeframe] = React.useState<Timeframe>("1Y");
  const [showSMA, setShowSMA] = React.useState(false);

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
  
  // Create FULL dataset for modal (ignoring grid-level 'days' prop if we want full history)
  const fullData = React.useMemo(() => {
     if (!data) return [];
     return data.map((item) => ({
      ...item,
      date: item.date,
    }));
  }, [data]);

  // Derived detailed data using fullData
  const detailedData = React.useMemo(() => {
    const filtered = filterByTimeframe(fullData, timeframe);
    const values = filtered.map(d => d.real_rate);
    const sma = calculateSMA(values, 50); // 50-period for rates
    
    return filtered.map((d, i) => ({
      ...d,
      sma: sma[i]
    }));
  }, [fullData, timeframe]);

  // Stats
  const stats = React.useMemo(() => {
    const values = detailedData.map(d => d.real_rate);
    return getFinancialStats(values);
  }, [detailedData]);

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
  
  const detailedLines = [
    { dataKey: "real_rate", stroke: "#8b5cf6", name: "Real Rate (%)" },
    ...(showSMA ? [{ dataKey: "sma", stroke: "#fbbf24", name: "SMA (50)" }] : []),
  ];

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
          data={detailedData}
          xDataKey="date"
          syncId="macro-charts-modal"
          mode="detailed"
          lines={detailedLines}
          formatXAxis={formatDate}
          formatYAxis={(v) => `${v.toFixed(1)}%`}
          height={400}
        />
      }
      modalActions={
        <div className="flex items-center gap-4">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
          <div className="h-6 w-px bg-border/50" />
          <IndicatorToggle label="SMA 50" checked={showSMA} onChange={setShowSMA} color="#fbbf24" />
        </div>
      }
      sidebarContent={
        <MetricSummarySidebar 
          stats={stats} 
          title="Rate Analysis"
          formatter={(v) => `${v.toFixed(2)}%`}
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
          {/* Liquidity Section */}
          <section id="liquidity">
            <LiquidityCard days={days} />
          </section>
          
          {/* Debt Metrics Section */}
          <section id="debt">
            <DebtStatusCard days={days} />
          </section>
          
          {/* Interest Rates Section */}
          <section id="rates">
            <RealRatesCard days={days} />
          </section>
        </div>
      </div>
    </ChartGridProvider>
  );
}
