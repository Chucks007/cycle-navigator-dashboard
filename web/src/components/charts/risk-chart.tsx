"use client";

import * as React from "react";
import { LightweightChart, SparklineChart } from "@/components/charts/lightweight-chart";
import { ExpandableChartCard } from "@/components/charts/expandable-chart-card";
import { LogScaleToggle, RegressionBandsToggle } from "@/components/charts/chart-controls";
import { useRiskData, useStockHistory } from "@/hooks/use-data";
import { transformRiskBandsToSeries, transformToOHLCData } from "@/lib/chart-utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExtraSeriesConfig } from "@/lib/chart-utils";

interface RiskChartProps {
  ticker: string;
  title?: string;
}

/**
 * Component demonstrating the Risk/Regression Bands feature.
 * Now wrapped in ExpandableChartCard for fullscreen capability.
 */
export function RiskChart({ ticker, title }: RiskChartProps) {
  const [showBands, setShowBands] = React.useState(true);
  const [logScale, setLogScale] = React.useState(true); // Log scale recommended for crypto

  // Fetch risk data (includes regression bands)
  const { data: riskData, isLoading: riskLoading, error: riskError } = useRiskData(ticker);
  
  // Fetch price history for the chart
  const { data: priceData, isLoading: priceLoading } = useStockHistory(
    ticker.includes("-") ? ticker : `${ticker}-USD`,
    "max",  // Get all available history
    "1d"    // Daily intervals
  );

  // Transform risk bands to chart series format
  const bandSeries: ExtraSeriesConfig[] = React.useMemo(() => {
    if (!riskData?.bands || !showBands) return [];
    return transformRiskBandsToSeries(riskData.bands, {
      lineWidth: 1,
      showLabels: false, // Too many labels can clutter the chart
      opacity: 0.15, // Low opacity so bands don't obscure price action
    });
  }, [riskData, showBands]);

  // Transform price data
  const chartData = React.useMemo(() => {
    if (!priceData) return [];
    return transformToOHLCData(priceData);
  }, [priceData]);

  // Shared Chart Content (Grid + Bar)
  const renderChartContent = (height: number | string) => (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 min-h-0">
        <LightweightChart
          ohlcData={chartData}
          seriesType="Candlestick"
          logScale={logScale}
          height={typeof height === 'number' ? height : undefined}
          extraSeries={bandSeries}
          fitContent
          className={typeof height === 'string' ? "h-full" : undefined}
        />
      </div>

      {/* Risk Score Bar */}
      {riskData && (
        <div className="mt-4 px-2 pb-2">
           {/* Risk Statistics Row */}
           <div className="hidden sm:flex justify-between text-xs text-muted-foreground mb-3">
             <div className="flex gap-4">
                <span>Price: <span className="font-mono text-foreground">${riskData.current_price.toLocaleString()}</span></span>
                <span>Fair Value: <span className="font-mono text-foreground">${riskData.fair_value.toLocaleString()}</span></span>
             </div>
             <div>
                <span>Risk: <span className="font-mono font-bold text-foreground">{(riskData.current_risk * 100).toFixed(1)}%</span></span>
             </div>
           </div>

           {/* Gradient Bar */}
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">
            <span>Undervalued</span>
            <span>Fair</span>
            <span>Bubble</span>
          </div>
          <div className="h-2 bg-gradient-to-r from-violet-500 via-green-500 to-red-500 rounded-full relative">
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-foreground rounded-full shadow transition-all duration-1000 ease-out"
              style={{ left: `${Math.min(Math.max(riskData.current_risk, 0), 1) * 100}%`, transform: 'translate(-50%, -50%)' }}
            />
          </div>
        </div>
      )}
    </div>
  );

  // Loading State
  if (riskLoading || priceLoading) {
    return (
       <Card className="h-[450px]">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-full w-full" />
        </CardContent>
       </Card>
    );
  }

  // Error State
  if (riskError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Error Loading Data</CardTitle>
          <CardDescription>{riskError.message}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <ExpandableChartCard
      id={`risk-${ticker}`}
      title={title || "Logarithmic Regression Corridors"}
      subtitle={
        riskData ? (
          <div className="flex items-center gap-2">
            <Badge style={{ backgroundColor: riskData.current_band.color }} className="text-white hover:opacity-90">
              {riskData.current_band.name}
            </Badge>
            <span className="text-xs text-muted-foreground">
               Model: Logarithmic Regression
            </span>
          </div>
        ) : undefined
      }
      modalActions={
        <div className="flex items-center gap-4">
          <LogScaleToggle checked={logScale} onChange={setLogScale} />
          <RegressionBandsToggle 
            checked={showBands} 
            onChange={setShowBands}
            disabled={!riskData}
          />
        </div>
      }
      condensedChart={renderChartContent(350)}
      detailedChart={renderChartContent("100%")}
    />
  );
}

/**
 * Simple Risk Score Card for dashboard overview.
 * Uses the lightweight /score endpoint for faster loading.
 */
export function RiskScoreCard({ ticker }: { ticker: string }) {
  const { data, isLoading, error } = useRiskData(ticker, true);

  if (isLoading) {
    return (
      <Card className="p-4">
        <Skeleton className="h-4 w-16 mb-2" />
        <Skeleton className="h-8 w-24" />
      </Card>
    );
  }

  if (error || !data) {
    return null;
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{ticker} Risk</p>
          <p className="text-2xl font-bold">
            {(data.current_risk * 100).toFixed(0)}%
          </p>
        </div>
        <Badge 
          style={{ backgroundColor: data.current_band.color }}
          className="text-white text-xs"
        >
          {data.current_band.name}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Fair Value: ${data.fair_value.toLocaleString()}
      </p>
    </Card>
  );
}
