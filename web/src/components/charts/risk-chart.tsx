"use client";

import * as React from "react";
import { LightweightChart } from "@/components/charts/lightweight-chart";
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
 * Example component demonstrating the Risk/Regression Bands feature.
 * 
 * This component:
 * 1. Fetches historical price data and risk/regression band data
 * 2. Displays a price chart with optional regression band overlays
 * 3. Shows the current risk score and band classification
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
    });
  }, [riskData, showBands]);

  // Transform price data
  const chartData = React.useMemo(() => {
    if (!priceData) return [];
    return transformToOHLCData(priceData);
  }, [priceData]);

  if (riskLoading || priceLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (riskError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title || ticker} Risk Analysis</CardTitle>
          <CardDescription className="text-destructive">
            Failed to load risk data: {riskError.message}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {title || ticker} Risk Analysis
              {riskData && (
                <Badge 
                  style={{ backgroundColor: riskData.current_band.color }}
                  className="text-white"
                >
                  {riskData.current_band.name}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Logarithmic regression fair value corridor
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-4">
            <LogScaleToggle checked={logScale} onChange={setLogScale} />
            <RegressionBandsToggle 
              checked={showBands} 
              onChange={setShowBands}
              disabled={!riskData}
            />
          </div>
        </div>

        {/* Risk Score Summary */}
        {riskData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
            <div>
              <span className="text-muted-foreground">Current Price</span>
              <p className="font-semibold">${riskData.current_price.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Fair Value</span>
              <p className="font-semibold">${riskData.fair_value.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Risk Score</span>
              <p className="font-semibold">
                {(riskData.current_risk * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Data Points</span>
              <p className="font-semibold">{riskData.data_points.toLocaleString()}</p>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <LightweightChart
          ohlcData={chartData}
          seriesType="Candlestick"
          logScale={logScale}
          height={400}
          extraSeries={bandSeries}
          fitContent
        />

        {/* Risk Score Bar */}
        {riskData && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Undervalued (0%)</span>
              <span>Fair Value (50%)</span>
              <span>Overvalued (100%)</span>
            </div>
            <div className="h-2 bg-gradient-to-r from-violet-500 via-green-500 to-red-500 rounded-full relative">
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-foreground rounded-full shadow"
                style={{ left: `${riskData.current_risk * 100}%`, transform: 'translate(-50%, -50%)' }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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
