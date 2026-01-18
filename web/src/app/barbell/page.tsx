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
import { TrendingUp, TrendingDown, Scale, AlertTriangle, Maximize2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ChartSkeleton } from "@/components/charts/synced-chart";
import { ExpandableChartCard } from "@/components/charts/expandable-chart-card";
import { ExpandableMetricCard } from "@/components/charts/expandable-metric-card";
import { MetricCard, MetricCardSkeleton } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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

function formatDateFull(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

// Sparkline component for mini charts in cards
function Sparkline({
  data,
  dataKey,
  color,
  height = 60,
}: {
  data: any[];
  dataKey: string;
  color: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#gradient-${dataKey})`}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Expandable Performance Card with integrated sparkline
interface ExpandablePerformanceCardProps {
  asset: AssetPerformance;
  data: any[];
  isLoading?: boolean;
}

function ExpandablePerformanceCard({
  asset,
  data,
  isLoading = false,
}: ExpandablePerformanceCardProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [chartKey, setChartKey] = React.useState(0);

  const isPositive = asset.pctGain >= 0;
  
  // Get sparkline data (last 30 points)
  const sparklineData = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.slice(-30).map((point) => ({
      date: point.date,
      value: point[asset.ticker] ?? 0,
    }));
  }, [data, asset.ticker]);

  const handleOpen = React.useCallback(() => {
    if (!isLoading) {
      setIsOpen(true);
      // Trigger chart resize after modal animation
      setTimeout(() => setChartKey((k) => k + 1), 100);
    }
  }, [isLoading]);

  return (
    <>
      {/* Clickable Card */}
      <div
        className={cn(
          "group relative overflow-hidden rounded-lg border p-4 backdrop-blur-xl",
          "border-border/50 bg-card/50",
          "transition-all duration-200 cursor-pointer",
          "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          isLoading && "pointer-events-none opacity-70"
        )}
        onClick={handleOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpen();
          }
        }}
        aria-label={`Expand ${asset.name} details`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent" />
        
        {/* Expand icon indicator */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <Maximize2 className="h-4 w-4 text-muted-foreground" />
        </div>

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
          
          {/* Sparkline */}
          <div className="mt-2 h-[50px]">
            {isLoading ? (
              <div className="h-full animate-pulse rounded bg-muted/20" />
            ) : (
              <Sparkline
                data={sparklineData}
                dataKey="value"
                color={asset.color}
                height={50}
              />
            )}
          </div>
          
          <div className="mt-2 flex items-center justify-between">
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

      {/* Expanded Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="max-w-[90vw] w-full max-h-[90vh] overflow-auto sm:max-w-[85vw] md:max-w-4xl lg:max-w-5xl"
          showCloseButton={true}
        >
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-3">
              <div
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: asset.color }}
              />
              {asset.name} ({asset.ticker}) Detail
            </DialogTitle>
            <DialogDescription>
              Historical price action and trend analysis (normalized to base 100)
            </DialogDescription>
          </DialogHeader>

          {/* Metric summary */}
          <div className="flex items-baseline gap-3 py-2">
            <span className="text-3xl font-bold">
              {asset.currentValue.toFixed(1)}
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                isPositive ? "text-green-500" : "text-red-500"
              )}
            >
              {isPositive ? "+" : ""}{asset.pctGain.toFixed(2)}%
            </span>
            <Badge variant={asset.assetType === "hard" ? "default" : "secondary"}>
              {asset.assetType === "hard" ? "🪨 Hard Asset" : "📄 Paper Asset"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-6 mt-4">
            {/* Detailed chart */}
            <div className="min-h-[300px] md:min-h-[400px]" key={chartKey}>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart
                  data={data}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id={`detail-gradient-${asset.ticker}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={asset.color} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={asset.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
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
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    labelFormatter={formatDateFull}
                    formatter={(value) => [
                      typeof value === "number" ? value.toFixed(2) : "",
                      asset.name,
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey={asset.ticker}
                    name={asset.name}
                    stroke={asset.color}
                    strokeWidth={2}
                    fill={`url(#detail-gradient-${asset.ticker})`}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Sidebar Stats */}
            <div className="space-y-4 lg:border-l lg:pl-6 border-border/50">
              <h4 className="font-semibold text-sm text-muted-foreground">STATISTICS</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Current Index</span>
                  <span className="font-mono font-medium">{asset.currentValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Period Change</span>
                  <span className={cn(
                    "font-mono font-medium",
                    isPositive ? "text-emerald-500" : "text-red-500"
                  )}>
                    {isPositive ? "+" : ""}{asset.pctGain.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Asset Type</span>
                  <span className="font-medium">
                    {asset.assetType === "hard" ? "Hard Asset" : "Paper Asset"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Data Points</span>
                  <span className="font-mono">{data?.length ?? 0}</span>
                </div>
              </div>
              
              <hr className="border-border/50" />
              
              <div className="text-xs text-muted-foreground">
                <p>
                  {asset.assetType === "hard" 
                    ? "Hard assets like gold and Bitcoin serve as inflation hedges and store of value during monetary uncertainty."
                    : "Paper assets like stocks and bonds provide growth and income but are subject to inflation risk."
                  }
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Expandable bucket card for Defensive/Offensive groupings
interface BucketCardProps {
  title: string;
  description: string;
  assets: AssetPerformance[];
  data: any[];
  bucketType: "defensive" | "offensive";
  isLoading?: boolean;
}

function ExpandableBucketCard({
  title,
  description,
  assets,
  data,
  bucketType,
  isLoading = false,
}: BucketCardProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [chartKey, setChartKey] = React.useState(0);

  // Calculate bucket average performance
  const avgPerformance = React.useMemo(() => {
    if (assets.length === 0) return 0;
    return assets.reduce((sum, a) => sum + a.pctGain, 0) / assets.length;
  }, [assets]);

  // Get sparkline data for the bucket (average of all assets)
  const sparklineData = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    const tickers = assets.map((a) => a.ticker);
    return data.slice(-30).map((point) => {
      const values = tickers.map((t) => point[t] ?? 0);
      const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      return { date: point.date, value: avg };
    });
  }, [data, assets]);

  const handleOpen = React.useCallback(() => {
    if (!isLoading) {
      setIsOpen(true);
      setTimeout(() => setChartKey((k) => k + 1), 100);
    }
  }, [isLoading]);

  const isPositive = avgPerformance >= 0;
  const bucketColor = bucketType === "defensive" ? "#FFD700" : "#00D4FF";

  return (
    <>
      {/* Clickable Card */}
      <div
        className={cn(
          "group relative overflow-hidden rounded-xl border p-5 backdrop-blur-xl",
          "border-border/50 bg-card/50",
          "transition-all duration-200 cursor-pointer",
          "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          isLoading && "pointer-events-none opacity-70"
        )}
        onClick={handleOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpen();
          }
        }}
        aria-label={`Expand ${title} details`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent" />
        
        {/* Expand icon indicator */}
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <Maximize2 className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">{title}</h3>
            <Badge variant={bucketType === "defensive" ? "default" : "secondary"}>
              {bucketType === "defensive" ? "🛡️ Defensive" : "⚔️ Offensive"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-3">{description}</p>
          
          {/* Mini asset chips */}
          <div className="flex flex-wrap gap-2 mb-3">
            {assets.map((asset) => (
              <div
                key={asset.ticker}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/30 text-xs"
              >
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: asset.color }}
                />
                <span className="font-mono">{asset.ticker}</span>
              </div>
            ))}
          </div>
          
          {/* Sparkline */}
          <div className="h-[60px]">
            {isLoading ? (
              <div className="h-full animate-pulse rounded bg-muted/20" />
            ) : (
              <Sparkline
                data={sparklineData}
                dataKey="value"
                color={bucketColor}
                height={60}
              />
            )}
          </div>
          
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Avg. Performance</span>
            <div
              className={cn(
                "flex items-center gap-1 text-lg font-bold",
                isPositive ? "text-emerald-500" : "text-red-500"
              )}
            >
              {isPositive ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )}
              {isPositive ? "+" : ""}
              {avgPerformance.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="max-w-[90vw] w-full max-h-[90vh] overflow-auto sm:max-w-[85vw] md:max-w-5xl lg:max-w-6xl"
          showCloseButton={true}
        >
          <DialogHeader>
            <DialogTitle className="text-xl">{title} Analysis</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {/* Summary metrics */}
          <div className="flex flex-wrap items-center gap-4 py-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {isPositive ? "+" : ""}{avgPerformance.toFixed(2)}%
              </span>
              <span className="text-sm text-muted-foreground">Avg. Return</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {assets.map((asset) => (
                <Badge
                  key={asset.ticker}
                  variant="outline"
                  className="font-mono"
                  style={{ borderColor: asset.color, color: asset.color }}
                >
                  {asset.ticker}: {asset.pctGain >= 0 ? "+" : ""}{asset.pctGain.toFixed(1)}%
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 mt-4">
            {/* Detailed chart showing all assets in bucket */}
            <div className="min-h-[300px] md:min-h-[400px]" key={chartKey}>
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
                    domain={["dataMin - 5", "dataMax + 5"]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    labelFormatter={formatDateFull}
                    formatter={(value, name) => [
                      typeof value === "number" ? value.toFixed(2) : "",
                      name,
                    ]}
                  />
                  <Legend />
                  {assets.map((asset) => (
                    <Line
                      key={asset.ticker}
                      type="monotone"
                      dataKey={asset.ticker}
                      name={asset.name}
                      stroke={asset.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Sidebar with individual asset stats */}
            <div className="space-y-4 lg:border-l lg:pl-6 border-border/50">
              <h4 className="font-semibold text-sm text-muted-foreground">ASSET BREAKDOWN</h4>
              <div className="space-y-4">
                {assets.map((asset) => {
                  const isAssetPositive = asset.pctGain >= 0;
                  return (
                    <div key={asset.ticker} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: asset.color }}
                          />
                          <span className="font-medium">{asset.name}</span>
                        </div>
                        <span className="font-mono text-sm">{asset.ticker}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Current</span>
                        <span className="font-mono">{asset.currentValue.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Change</span>
                        <span className={cn(
                          "font-mono",
                          isAssetPositive ? "text-emerald-500" : "text-red-500"
                        )}>
                          {isAssetPositive ? "+" : ""}{asset.pctGain.toFixed(2)}%
                        </span>
                      </div>
                      <hr className="border-border/30 mt-2" />
                    </div>
                  );
                })}
              </div>
              
              <div className="text-xs text-muted-foreground mt-4">
                <p>
                  {bucketType === "defensive"
                    ? "Defensive assets provide protection during market downturns and inflationary periods."
                    : "Offensive assets aim for capital appreciation during risk-on market conditions."
                  }
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
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

  // Group assets by bucket type
  const hardAssets = performance.filter((a) => a.assetType === "hard");
  const softAssets = performance.filter((a) => a.assetType === "soft");

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
  
  const latestHardIndex = ratioData.length > 0 ? ratioData[ratioData.length - 1].hardIndex : 100;
  const latestSoftIndex = ratioData.length > 0 ? ratioData[ratioData.length - 1].softIndex : 100;

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

      {/* Ratio Summary - Expandable Metric Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {isLoading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            {/* Hard/Soft Ratio Card - Expandable */}
            <ExpandableMetricCard
              id="ratio-card"
              title="Hard/Soft Asset Ratio Analysis"
              description="Detailed view of hard vs paper asset performance ratio over time"
              isLoading={isLoading}
              expandedContent={
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
                      labelFormatter={formatDateFull}
                      formatter={(value) => [
                        typeof value === "number" ? value.toFixed(2) : "",
                        "Ratio",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="ratio"
                      name="Hard/Soft Ratio"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                      connectNulls={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              }
              sidebarContent={
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground">INTERPRETATION</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Ratio</span>
                      <span className="font-mono font-medium">{latestRatio.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Period Change</span>
                      <span className={cn(
                        "font-mono font-medium",
                        ratioChange > 0 ? "text-emerald-500" : "text-red-500"
                      )}>
                        {ratioChange > 0 ? "+" : ""}{ratioChange.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <hr className="border-border/50" />
                  <div className="text-xs text-muted-foreground">
                    <p className="mb-2">
                      <strong>Rising ratio:</strong> Hard assets outperforming paper assets - suggests inflation hedging demand.
                    </p>
                    <p>
                      <strong>Falling ratio:</strong> Paper assets outperforming - suggests risk-on sentiment.
                    </p>
                  </div>
                </div>
              }
            >
              <MetricCard
                title="Hard/Soft Ratio"
                value={`${latestRatio.toFixed(1)}`}
                subtitle="Rising = Hard assets outperforming"
                icon={<Scale className="h-4 w-4" />}
                change={ratioChange}
                changeLabel={`Since ${period} start`}
                variant={ratioChange > 0 ? "success" : "warning"}
              />
            </ExpandableMetricCard>

            {/* Hard Assets Index - Expandable */}
            <ExpandableMetricCard
              id="hard-index-card"
              title="Hard Assets Index Performance"
              description="Average performance of Gold, Silver, and Bitcoin"
              isLoading={isLoading}
              expandedContent={
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
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      labelFormatter={formatDateFull}
                      formatter={(value) => [
                        typeof value === "number" ? value.toFixed(2) : "",
                        "Index",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="hardIndex"
                      name="Hard Assets Index"
                      stroke="#FFD700"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              }
              sidebarContent={
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground">COMPONENTS</h4>
                  <div className="space-y-2">
                    {hardAssets.map((asset) => (
                      <div key={asset.ticker} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: asset.color }} />
                          <span>{asset.ticker}</span>
                        </div>
                        <span className={cn(
                          "font-mono",
                          asset.pctGain >= 0 ? "text-emerald-500" : "text-red-500"
                        )}>
                          {asset.pctGain >= 0 ? "+" : ""}{asset.pctGain.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              }
            >
              <MetricCard
                title="Hard Assets Index"
                value={`${latestHardIndex.toFixed(1)}`}
                subtitle="Avg. of GLD, SLV, BTC"
                variant="default"
              />
            </ExpandableMetricCard>

            {/* Paper Assets Index - Expandable */}
            <ExpandableMetricCard
              id="soft-index-card"
              title="Paper Assets Index Performance"
              description="Average performance of S&P 500 and Long-Term Treasuries"
              isLoading={isLoading}
              expandedContent={
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
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      labelFormatter={formatDateFull}
                      formatter={(value) => [
                        typeof value === "number" ? value.toFixed(2) : "",
                        "Index",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="softIndex"
                      name="Paper Assets Index"
                      stroke="#00D4FF"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              }
              sidebarContent={
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground">COMPONENTS</h4>
                  <div className="space-y-2">
                    {softAssets.map((asset) => (
                      <div key={asset.ticker} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: asset.color }} />
                          <span>{asset.ticker}</span>
                        </div>
                        <span className={cn(
                          "font-mono",
                          asset.pctGain >= 0 ? "text-emerald-500" : "text-red-500"
                        )}>
                          {asset.pctGain >= 0 ? "+" : ""}{asset.pctGain.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              }
            >
              <MetricCard
                title="Paper Assets Index"
                value={`${latestSoftIndex.toFixed(1)}`}
                subtitle="Avg. of SPY, TLT"
                variant="default"
              />
            </ExpandableMetricCard>
          </>
        )}
      </div>

      {/* Bucket Cards - Defensive & Offensive */}
      <section id="buckets" className="grid gap-6 md:grid-cols-2">
        <ExpandableBucketCard
          title="Hard Assets (Defensive)"
          description="Inflation hedges and stores of value"
          assets={hardAssets}
          data={data ?? []}
          bucketType="defensive"
          isLoading={isLoading}
        />
        <ExpandableBucketCard
          title="Paper Assets (Offensive)"
          description="Traditional financial instruments for growth"
          assets={softAssets}
          data={data ?? []}
          bucketType="offensive"
          isLoading={isLoading}
        />
      </section>

      {/* Hard Assets Section - Individual Expandable Cards */}
      <section id="hard-assets">
        <h3 className="text-lg font-semibold mb-4">Hard Assets Performance</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array(3)
                .fill(0)
                .map((_, i) => (
                  <div
                    key={i}
                    className="h-48 animate-pulse rounded-lg bg-muted/20"
                  />
                ))
            : hardAssets.map((asset) => (
                <ExpandablePerformanceCard
                  key={asset.ticker}
                  asset={asset}
                  data={data ?? []}
                  isLoading={isLoading}
                />
              ))}
        </div>
      </section>

      {/* Paper Assets Section - Individual Expandable Cards */}
      <section id="paper-assets">
        <h3 className="text-lg font-semibold mb-4">Paper Assets Performance</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array(2)
                .fill(0)
                .map((_, i) => (
                  <div
                    key={i}
                    className="h-48 animate-pulse rounded-lg bg-muted/20"
                  />
                ))
            : softAssets.map((asset) => (
                <ExpandablePerformanceCard
                  key={asset.ticker}
                  asset={asset}
                  data={data ?? []}
                  isLoading={isLoading}
                />
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
