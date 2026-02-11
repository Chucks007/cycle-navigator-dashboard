"use client";

import * as React from "react";
import { TrendingUp, TrendingDown, Scale, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ChartSkeleton } from "@/components/charts/synced-chart";
import { ExpandableChartCard } from "@/components/charts/expandable-chart-card";
import { ExpandableMetricCard } from "@/components/charts/expandable-metric-card";
import { LightweightChart } from "@/components/charts/lightweight-chart";
import { MetricCard, MetricCardSkeleton } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toChartTime, type ChartDataPoint, type ExtraSeriesConfig } from "@/lib/transformations";
import { 
  ExpandablePerformanceCard, 
  type AssetPerformance 
} from "@/components/features/barbell/performance-card";
import { ExpandableBucketCard } from "@/components/features/barbell/bucket-card";

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

// Type for asset data points
interface AssetDataPoint {
  date: string;
  [ticker: string]: string | number; // date is string, asset values are numbers
}

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
    
    return data.map((point: AssetDataPoint) => {
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
                <div className="h-[400px] w-full">
                  <LightweightChart
                    seriesType="Line"
                    data={ratioData.map(d => ({
                      time: toChartTime(d.date),
                      value: d.ratio
                    })).filter((d): d is ChartDataPoint => d.time !== null && !isNaN(d.value))}
                    colors={{ lineColor: "#3b82f6" }}
                    title="Hard/Soft Ratio"
                  />
                </div>
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
                <div className="h-[400px] w-full">
                  <LightweightChart
                    seriesType="Line"
                    data={ratioData.map(d => ({
                      time: toChartTime(d.date),
                      value: d.hardIndex
                    })).filter((d): d is ChartDataPoint => d.time !== null && !isNaN(d.value))}
                    colors={{ lineColor: "#FFD700" }}
                    title="Hard Assets Index"
                  />
                </div>
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
                <div className="h-[400px] w-full">
                  <LightweightChart
                    seriesType="Line"
                    data={ratioData.map(d => ({
                      time: toChartTime(d.date),
                      value: d.softIndex
                    })).filter((d): d is ChartDataPoint => d.time !== null && !isNaN(d.value))}
                    colors={{ lineColor: "#00D4FF" }}
                    title="Paper Assets Index"
                  />
                </div>
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
            <div className="h-[160px] w-full">
              {(() => {
                const hardSeries = selectedHard.map(ticker => ({
                  data: (data ?? []).slice(-60).map((d: AssetDataPoint) => ({
                    time: toChartTime(d.date),
                    value: d[ticker] as number
                  })).filter((pt): pt is ChartDataPoint => pt.time !== null && pt.value !== undefined && !isNaN(pt.value)),
                  color: HARD_ASSETS[ticker as keyof typeof HARD_ASSETS]?.color,
                  name: ticker
                }));
                const softSeries = selectedSoft.map(ticker => ({
                  data: (data ?? []).slice(-60).map((d: AssetDataPoint) => ({
                    time: toChartTime(d.date),
                    value: d[ticker] as number
                  })).filter((pt): pt is ChartDataPoint => pt.time !== null && pt.value !== undefined && !isNaN(pt.value)),
                  color: SOFT_ASSETS[ticker as keyof typeof SOFT_ASSETS]?.color,
                  name: ticker
                }));
                const allSeries = [...hardSeries, ...softSeries];
                if (allSeries.length === 0) return null;
                const [first, ...rest] = allSeries;

                return (
                  <LightweightChart
                    seriesType="Line"
                    data={first.data}
                    colors={{ lineColor: first.color }}
                    title={first.name}
                    height={160}
                    timeScaleVisible={false}
                    priceScaleVisible={false}
                    priceLineVisible={false}
                    lastValueVisible={false}
                    extraSeries={rest.map(s => ({
                      data: s.data,
                      color: s.color,
                      title: s.name,
                      priceLineVisible: false,
                      lastValueVisible: false,
                    }))}
                  />
                );
              })()}
            </div>
          }
          detailedChart={
            <div className="h-[400px] w-full">
              {(() => {
                const hardSeries = selectedHard.map(ticker => ({
                  data: (data ?? []).map((d: AssetDataPoint) => ({
                    time: toChartTime(d.date),
                    value: d[ticker] as number
                  })).filter((pt): pt is ChartDataPoint => pt.time !== null && pt.value !== undefined && !isNaN(pt.value)),
                  color: HARD_ASSETS[ticker as keyof typeof HARD_ASSETS]?.color,
                  name: HARD_ASSETS[ticker as keyof typeof HARD_ASSETS]?.name
                }));
                const softSeries = selectedSoft.map(ticker => ({
                  data: (data ?? []).map((d: AssetDataPoint) => ({
                    time: toChartTime(d.date),
                    value: d[ticker] as number
                  })).filter((pt): pt is ChartDataPoint => pt.time !== null && pt.value !== undefined && !isNaN(pt.value)),
                  color: SOFT_ASSETS[ticker as keyof typeof SOFT_ASSETS]?.color,
                  name: SOFT_ASSETS[ticker as keyof typeof SOFT_ASSETS]?.name
                }));
                const allSeries = [...hardSeries, ...softSeries];
                if (allSeries.length === 0) return null;
                const [first, ...rest] = allSeries;

                return (
                  <LightweightChart
                    seriesType="Line"
                    data={first.data}
                    colors={{ lineColor: first.color }}
                    title={first.name}
                    height={400}
                    extraSeries={rest.map(s => ({
                      data: s.data,
                      color: s.color,
                      title: s.name,
                    }))}
                  />
                );
              })()}
            </div>
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
            <div className="h-[160px] w-full">
               <LightweightChart
                  seriesType="Line"
                  data={ratioData.slice(-60).map(d => ({
                      time: toChartTime(d.date),
                      value: d.ratio
                  })).filter((d): d is ChartDataPoint => d.time !== null && !isNaN(d.value))}
                  colors={{ lineColor: "#3b82f6" }}
                  title="Hard/Soft Ratio"
                  height={160}
                  timeScaleVisible={false}
                  priceScaleVisible={false}
                  priceLineVisible={false}
                  lastValueVisible={false}
               />
            </div>
          }
          detailedChart={
            <div className="h-[400px] w-full">
               <LightweightChart
                  seriesType="Line"
                  data={ratioData.map(d => ({
                      time: toChartTime(d.date),
                      value: d.ratio
                  })).filter((d): d is ChartDataPoint => d.time !== null && !isNaN(d.value))}
                  colors={{ lineColor: "#3b82f6" }}
                  title="Hard/Soft Ratio"
               />
            </div>
          }
        />
      </section>
    </div>
  );
}
