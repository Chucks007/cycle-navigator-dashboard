"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Scale, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ChartSkeleton } from "@/components/charts/synced-chart";
import { ExpandableChartCard } from "@/components/charts/expandable-chart-card";
import { MetricCard, MetricCardSkeleton } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// Asset definitions
const HARD_ASSETS = {
  GLD: { name: "Gold", color: "#FFD700" },
  SLV: { name: "Silver", color: "#C0C0C0" },
  "BTC-USD": { name: "Bitcoin", color: "#F7931A" },
};

const SOFT_ASSETS = {
  SPY: { name: "S&P 500", color: "#00D4FF" },
  TLT: { name: "Long-Term Treasuries", color: "#9D4EDD" },
};

const COMPARISON_PERIODS = {
  YTD: "ytd",
  "1Y": "1y",
  "3Y": "3y",
  "5Y": "5y",
  "10Y": "10y",
};

// Mock data generator for demo (replace with actual API when available)
function generateMockData(period: string) {
  const points = period === "YTD" ? 50 : period === "1Y" ? 252 : period === "3Y" ? 756 : 1260;
  const data = [];
  
  const startValues = {
    GLD: 100,
    SLV: 100,
    "BTC-USD": 100,
    SPY: 100,
    TLT: 100,
  };

  for (let i = 0; i < points; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (points - i));
    
    // Simulate different asset behaviors
    startValues.GLD += (Math.random() - 0.48) * 1.5;
    startValues.SLV += (Math.random() - 0.47) * 2;
    startValues["BTC-USD"] += (Math.random() - 0.45) * 5;
    startValues.SPY += (Math.random() - 0.48) * 1.2;
    startValues.TLT += (Math.random() - 0.52) * 0.8;

    data.push({
      date: date.toISOString().split("T")[0],
      GLD: Math.max(50, startValues.GLD),
      SLV: Math.max(30, startValues.SLV),
      "BTC-USD": Math.max(20, startValues["BTC-USD"]),
      SPY: Math.max(60, startValues.SPY),
      TLT: Math.max(70, startValues.TLT),
    });
  }
  
  return data;
}

function useComparisonData(period: string, selectedAssets: string[]) {
  return useQuery({
    queryKey: ["comparison", period, selectedAssets],
    queryFn: async () => {
      // In production, this would call the backend API
      // For now, return mock data
      return generateMockData(period);
    },
    staleTime: 5 * 60 * 1000,
  });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Performance Summary Card
interface AssetPerformance {
  ticker: string;
  name: string;
  currentValue: number;
  pctGain: number;
  assetType: "hard" | "soft";
  color: string;
}

function PerformanceCard({ asset }: { asset: AssetPerformance }) {
  const isPositive = asset.pctGain >= 0;
  
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border p-4 backdrop-blur-xl transition-all duration-300 hover:border-primary/50",
        "border-border/50 bg-card/50"
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: asset.color }}
            />
            <span className="font-mono font-medium">{asset.ticker}</span>
          </div>
          <Badge variant={asset.assetType === "hard" ? "default" : "secondary"}>
            {asset.assetType === "hard" ? "🪨 Hard" : "📄 Paper"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{asset.name}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-2xl font-bold">{asset.currentValue.toFixed(1)}</span>
          <div
            className={cn(
              "flex items-center gap-1 text-sm font-medium",
              isPositive ? "text-emerald-500" : "text-red-500"
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            {isPositive ? "+" : ""}
            {asset.pctGain.toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default function BarbellStrategyPage() {
  const [period, setPeriod] = React.useState("1Y");
  const [selectedHard, setSelectedHard] = React.useState<string[]>(
    Object.keys(HARD_ASSETS)
  );
  const [selectedSoft, setSelectedSoft] = React.useState<string[]>(
    Object.keys(SOFT_ASSETS)
  );

  const allSelected = [...selectedHard, ...selectedSoft];
  const { data, isLoading, error } = useComparisonData(period, allSelected);

  // Calculate performance from data
  const performance = React.useMemo<AssetPerformance[]>(() => {
    if (!data || data.length < 2) return [];
    
    const first = data[0];
    const last = data[data.length - 1];
    
    const results: AssetPerformance[] = [];
    
    for (const [ticker, info] of Object.entries(HARD_ASSETS)) {
      if (selectedHard.includes(ticker)) {
        results.push({
          ticker,
          name: info.name,
          currentValue: last[ticker as keyof typeof last] as number,
          pctGain: ((last[ticker as keyof typeof last] as number) - 100),
          assetType: "hard",
          color: info.color,
        });
      }
    }
    
    for (const [ticker, info] of Object.entries(SOFT_ASSETS)) {
      if (selectedSoft.includes(ticker)) {
        results.push({
          ticker,
          name: info.name,
          currentValue: last[ticker as keyof typeof last] as number,
          pctGain: ((last[ticker as keyof typeof last] as number) - 100),
          assetType: "soft",
          color: info.color,
        });
      }
    }
    
    return results.sort((a, b) => b.pctGain - a.pctGain);
  }, [data, selectedHard, selectedSoft]);

  // Calculate Hard vs Soft ratio
  const ratioData = React.useMemo(() => {
    if (!data) return [];
    
    return data.map((point: any) => {
      const getPrice = (ticker: string) => {
        let val = point[ticker];
        // Robust key lookup
        if (!val && ticker === 'GLD') val = point['GC=F'];
        if (!val && ticker === 'SPY') val = point['^GSPC'];
        return Number(val || 0);
      };

      const hardValues = selectedHard.map((t) => getPrice(t));
      const softValues = selectedSoft.map((t) => getPrice(t));
      
      const hardSum = hardValues.reduce((a, b) => a + b, 0);
      const hardAvg = hardValues.length > 0 ? hardSum / hardValues.length : 0;
      
      const softSum = softValues.reduce((a, b) => a + b, 0);
      const softAvg = softValues.length > 0 ? softSum / softValues.length : 0;

      if (hardAvg <= 0 || softAvg <= 0) return null;
      
      return {
        date: point.date,
        hardIndex: hardAvg,
        softIndex: softAvg,
        ratio: (hardAvg / softAvg) * 100,
      };
    }).filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [data, selectedHard, selectedSoft]);

  const latestRatio = ratioData.length > 0 ? ratioData[ratioData.length - 1].ratio : 100;
  const firstRatio = ratioData.length > 0 ? ratioData[0].ratio : 100;
  const ratioChange = latestRatio - firstRatio;

  if (error) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-destructive">
        <AlertTriangle className="mr-2 h-5 w-5" />
        Failed to load comparison data
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Overview Section */}
      <section id="overview">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Scale className="h-8 w-8" />
          The Barbell Strategy
        </h1>
        <p className="text-muted-foreground mt-1">
          Compare <span className="text-amber-500 font-medium">Hard Assets</span>{" "}
          (Gold, Silver, Bitcoin) against{" "}
          <span className="text-cyan-500 font-medium">Paper Assets</span>{" "}
          (Stocks, Bonds) to track rotation into inflation hedges.
        </p>
      </section>

      {/* Period Selector */}
      <Tabs value={period} onValueChange={setPeriod} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-5">
          {Object.keys(COMPARISON_PERIODS).map((p) => (
            <TabsTrigger key={p} value={p}>
              {p}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Ratio Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        {isLoading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              title="Hard/Soft Ratio"
              value={`${latestRatio.toFixed(1)}`}
              subtitle="Rising = Hard assets outperforming"
              icon={<Scale className="h-4 w-4" />}
              change={ratioChange}
              changeLabel={`Since ${period} start`}
              variant={ratioChange > 0 ? "success" : "warning"}
            />
            <MetricCard
              title="Hard Assets Index"
              value={`${ratioData.length > 0 ? ratioData[ratioData.length - 1].hardIndex.toFixed(1) : 100}`}
              subtitle="Avg. of GLD, SLV, BTC"
              variant="default"
            />
            <MetricCard
              title="Paper Assets Index"
              value={`${ratioData.length > 0 ? ratioData[ratioData.length - 1].softIndex.toFixed(1) : 100}`}
              subtitle="Avg. of SPY, TLT"
              variant="default"
            />
          </>
        )}
      </div>

      {/* Hard Assets Section */}
      <section id="hard-assets">
        <h3 className="text-lg font-semibold mb-4">Hard Assets Performance</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array(3)
                .fill(0)
                .map((_, i) => (
                  <div
                    key={i}
                    className="h-32 animate-pulse rounded-lg bg-muted/20"
                  />
                ))
            : performance
                .filter((asset) => asset.assetType === "hard")
                .map((asset) => (
                  <PerformanceCard key={asset.ticker} asset={asset} />
                ))}
        </div>
      </section>

      {/* Paper Assets Section */}
      <section id="paper-assets">
        <h3 className="text-lg font-semibold mb-4">Paper Assets Performance</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array(2)
                .fill(0)
                .map((_, i) => (
                  <div
                    key={i}
                    className="h-32 animate-pulse rounded-lg bg-muted/20"
                  />
                ))
            : performance
                .filter((asset) => asset.assetType === "soft")
                .map((asset) => (
                  <PerformanceCard key={asset.ticker} asset={asset} />
                ))}
        </div>
      </section>

      {/* Comparison Section */}
      <section id="comparison" className="space-y-6">
        <ExpandableChartCard
          id="normalized-performance"
          title="Normalized Performance (Base 100)"
          subtitle="All assets start at 100 for easy comparison"
          isLoading={isLoading}
          condensedChart={
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={data?.slice(-60)} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <Legend wrapperStyle={{ fontSize: '10px', marginTop: '0px' }} />
                {selectedHard.map((ticker) => (
                  <Line
                    key={ticker}
                    type="monotone"
                    dataKey={ticker}
                    stroke={HARD_ASSETS[ticker as keyof typeof HARD_ASSETS]?.color}
                    strokeWidth={1.5}
                    dot={false}
                  />
                ))}
                {selectedSoft.map((ticker) => (
                  <Line
                    key={ticker}
                    type="monotone"
                    dataKey={ticker}
                    stroke={SOFT_ASSETS[ticker as keyof typeof SOFT_ASSETS]?.color}
                    strokeWidth={1.5}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          }
          detailedChart={
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={data}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-border/30"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value) => [typeof value === 'number' ? value.toFixed(2) : '', '']}
                />
                <Legend />
                {selectedHard.map((ticker) => (
                  <Line
                    key={ticker}
                    type="monotone"
                    dataKey={ticker}
                    name={HARD_ASSETS[ticker as keyof typeof HARD_ASSETS]?.name}
                    stroke={HARD_ASSETS[ticker as keyof typeof HARD_ASSETS]?.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
                {selectedSoft.map((ticker) => (
                  <Line
                    key={ticker}
                    type="monotone"
                    dataKey={ticker}
                    name={SOFT_ASSETS[ticker as keyof typeof SOFT_ASSETS]?.name}
                    stroke={SOFT_ASSETS[ticker as keyof typeof SOFT_ASSETS]?.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          }
        />

        {/* Hard vs Soft Ratio Chart */}
        <ExpandableChartCard
          id="hard-soft-ratio"
          title="Hard Assets vs Paper Assets Ratio"
          subtitle="Rising ratio indicates rotation into hard assets"
          metricValue={latestRatio.toFixed(1)}
          metricChange={ratioChange}
          changeLabel={`Since ${period} start`}
          variant={ratioChange > 0 ? "success" : "warning"}
          isLoading={isLoading}
          condensedChart={
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={ratioData.slice(-60)} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <Line
                  type="monotone"
                  dataKey="ratio"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="Hard/Soft Ratio"
                  connectNulls={true}
                />
                <Legend wrapperStyle={{ fontSize: '11px', marginTop: '0px' }} />
              </LineChart>
            </ResponsiveContainer>
          }
          detailedChart={
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={ratioData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-border/30"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                  width={60}
                  domain={["dataMin - 5", "dataMax + 5"]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value) => [typeof value === 'number' ? value.toFixed(2) : '', 'Ratio']}
                />
                <Line
                  type="monotone"
                  dataKey="ratio"
                  name="Hard/Soft Ratio"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls={true}
                />
              </LineChart>
            </ResponsiveContainer>
          }
        />
      </section>
    </div>
  );
}
