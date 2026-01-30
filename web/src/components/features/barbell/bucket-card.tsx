"use client";

import * as React from "react";
import { TrendingUp, TrendingDown, Maximize2 } from "lucide-react";
import { SparklineChart, LightweightChart } from "@/components/charts/lightweight-chart";
import { Badge } from "@/components/ui/badge";
import { DashboardCard } from "@/components/ui/dashboard-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toChartTime, type ChartDataPoint, type ExtraSeriesConfig } from "@/lib/chart-utils";

// Type for asset data points
interface AssetDataPoint {
  date: string;
  [ticker: string]: string | number; // date is string, asset values are numbers
}
import type { AssetPerformance } from "./performance-card";

interface BucketCardProps {
  title: string;
  description: string;
  assets: AssetPerformance[];
  data: AssetDataPoint[];
  bucketType: "defensive" | "offensive";
  isLoading?: boolean;
}

export function ExpandableBucketCard({
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
  const sparklineData = React.useMemo((): ChartDataPoint[] => {
    if (!data || data.length === 0) return [];
    const tickers = assets.map((a) => a.ticker);
    return data.slice(-30).map((point) => {
      const values: number[] = tickers.map((t) => {
        const val = point[t];
        return typeof val === 'number' ? val : 0;
      });
      const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      return { time: toChartTime(point.date), value: avg };
    }).filter((point): point is ChartDataPoint => point.time !== null && isFinite(point.value));
  }, [data, assets]);

  // Detailed chart data with multiple series
  const { mainSeriesData, extraSeries } = React.useMemo(() => {
    if (!data || data.length === 0 || assets.length === 0) {
      return { mainSeriesData: [], extraSeries: [] };
    }

    // Use first asset as main series
    const firstAsset = assets[0];
    const mainData = data.map((point) => {
      const val = point[firstAsset.ticker];
      return {
        time: toChartTime(point.date),
        value: typeof val === 'number' ? val : 0,
      };
    }).filter((point): point is ChartDataPoint => point.time !== null && isFinite(point.value));

    // Others as extra series
    const extras: ExtraSeriesConfig[] = assets.slice(1).map((asset) => ({
      data: data.map((point) => {
        const val = point[asset.ticker];
        return {
          time: toChartTime(point.date),
          value: typeof val === 'number' ? val : 0,
        };
      }).filter((point): point is ChartDataPoint => point.time !== null && isFinite(point.value)),
      color: asset.color,
      title: asset.name,
      lineWidth: 2,
    }));

    return { mainSeriesData: mainData, extraSeries: extras };
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
      <DashboardCard
        variant="interactive"
        className={cn(
          "group p-5",
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
              <SparklineChart
                data={sparklineData}
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
      </DashboardCard>

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
              <LightweightChart
                data={mainSeriesData}
                seriesType="Line"
                colors={{
                  lineColor: assets[0]?.color ?? "#333",
                }}
                extraSeries={extraSeries}
                height={400}
                fitContent
              />
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
