"use client";

import * as React from "react";
import { TrendingUp, TrendingDown, Maximize2 } from "lucide-react";
import { SparklineChart, LightweightChart } from "@/components/charts/lightweight-chart";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toChartTime, type ChartDataPoint } from "@/lib/chart-utils";

export interface AssetPerformance {
  ticker: string;
  name: string;
  currentValue: number;
  pctGain: number;
  assetType: "hard" | "soft";
  color: string;
}

interface ExpandablePerformanceCardProps {
  asset: AssetPerformance;
  data: any[];
  isLoading?: boolean;
}

export function ExpandablePerformanceCard({
  asset,
  data,
  isLoading = false,
}: ExpandablePerformanceCardProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [chartKey, setChartKey] = React.useState(0);

  const isPositive = asset.pctGain >= 0;
  
  // Get sparkline data (last 30 points)
  const sparklineData = React.useMemo((): ChartDataPoint[] => {
    if (!data || data.length === 0) return [];
    return data.slice(-30).map((point) => ({
      time: toChartTime(point.date),
      value: point[asset.ticker] ?? 0,
    }));
  }, [data, asset.ticker]);

  // Full chart data
  const chartData = React.useMemo((): ChartDataPoint[] => {
    if (!data || data.length === 0) return [];
    return data.map((point) => ({
      time: toChartTime(point.date),
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
              <SparklineChart
                data={sparklineData}
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
              <LightweightChart
                data={chartData}
                seriesType="Area"
                colors={{
                  lineColor: asset.color,
                  topColor: asset.color + "33", // 20% opacity using hex
                  bottomColor: "transparent",
                }}
                height={400}
                fitContent
              />
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
