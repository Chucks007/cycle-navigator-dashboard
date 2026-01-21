"use client";

import * as React from "react";
import { useCryptoDominance } from "@/hooks/use-data";
import { LightweightChart } from "@/components/charts/lightweight-chart";
import { ExpandableChartCard } from "@/components/charts/expandable-chart-card";
import { TimeframeSelector, type Timeframe } from "@/components/charts/chart-controls";
import { formatLargeNumber, filterByTimeframe } from "@/lib/formatters";
import { getFinancialStats } from "@/lib/financial-math";
import { transformToLineDataWithKey, type ChartDataPoint, type ExtraSeriesConfig } from "@/lib/chart-utils";
import type { Time } from "lightweight-charts";

/**
 * Crypto Dominance Card
 * 
 * Displays a stacked area chart showing Bitcoin, Ethereum, and Altcoin market cap
 * distribution over time. Used to identify "Risk-On" regimes where liquidity flows
 * from Bitcoin into Altcoins (Alt-Season).
 * 
 * Visual Goal: Users should see the "Alt-Season" expansion when the "OTHERS" area
 * grows relative to BTC dominance.
 */
export function DominanceCard() {
  const { data: response, isLoading, error } = useCryptoDominance(365);
  
  // Local state for modal
  const [timeframe, setTimeframe] = React.useState<Timeframe>("1Y");

  // Extract data points from response
  const rawData = React.useMemo(() => {
    if (!response?.data) return [];
    return response.data;
  }, [response]);

  // Transform data for charts (ensure 'date' field for filterByTimeframe)
  const chartData = React.useMemo(() => {
    return rawData.map((item) => {
      const btcMcap = item.total_mcap * (item.btc_dominance / 100);
      const ethMcap = item.total_mcap * (item.eth_dominance / 100);
      const altcoinMcap = item.altcoin_mcap;

      return {
        date: item.timestamp, // Keep for filterByTimeframe compatibility
        time: new Date(item.timestamp).getTime() / 1000, // Unix timestamp in seconds
        btc: btcMcap,
        btcEth: btcMcap + ethMcap, // Cumulative for stacking
        total: item.total_mcap, // Cumulative total
        // Store raw values for tooltips/stats
        btc_dominance: item.btc_dominance,
        eth_dominance: item.eth_dominance,
        altcoin_mcap: altcoinMcap,
      };
    });
  }, [rawData]);

  // Filter by timeframe for detailed view
  const detailedData = React.useMemo(() => {
    const filtered = filterByTimeframe(chartData, timeframe);
    return filtered;
  }, [chartData, timeframe]);

  // Latest metrics for sparkline card
  const latestMetrics = React.useMemo(() => {
    if (chartData.length === 0) return null;
    const latest = chartData[chartData.length - 1];
    return {
      totalMcap: latest.total,
      btcDominance: latest.btc_dominance,
      ethDominance: latest.eth_dominance,
      othersDominance: 100 - latest.btc_dominance - latest.eth_dominance,
    };
  }, [chartData]);

  // Stats for BTC dominance
  const btcDomStats = React.useMemo(() => {
    const values = chartData.map(d => d.btc_dominance);
    const stats = getFinancialStats(values);
    // Calculate percent change
    const first = values[0] || 0;
    const last = values[values.length - 1] || 0;
    const percentChange = first !== 0 ? ((last - first) / first) * 100 : 0;
    
    return { ...stats, percentChange };
  }, [chartData]);

  // Simple sparkline data (just BTC dominance trend)
  const sparklineData = React.useMemo((): ChartDataPoint[] => {
    return transformToLineDataWithKey(
      chartData.map(d => ({ date: d.date, value: d.btc_dominance })),
      "value"
    );
  }, [chartData]);

  // Prepare detailed chart data (for stacked areas)
  const detailedBtcData = React.useMemo((): ChartDataPoint[] => {
    return detailedData.map(d => ({ time: d.time as Time, value: d.btc }));
  }, [detailedData]);

  const detailedBtcEthData = React.useMemo((): ChartDataPoint[] => {
    return detailedData.map(d => ({ time: d.time as Time, value: d.btcEth }));
  }, [detailedData]);

  const detailedTotalData = React.useMemo((): ChartDataPoint[] => {
    return detailedData.map(d => ({ time: d.time as Time, value: d.total }));
  }, [detailedData]);

  // Extra series for stacked areas (BTC, ETH, OTHERS)
  const extraSeries = React.useMemo((): ExtraSeriesConfig[] => {
    return [
      // Bottom layer: BTC (Blue)
      {
        data: detailedBtcData,
        color: "rgba(59, 130, 246, 0.8)",
        lineWidth: 2,
        seriesType: "Area",
        topColor: "rgba(59, 130, 246, 0.6)",
        bottomColor: "rgba(59, 130, 246, 0.1)",
        title: "Bitcoin",
      },
      // Middle layer: ETH (Purple)
      {
        data: detailedBtcEthData,
        color: "rgba(168, 85, 247, 0.8)",
        lineWidth: 2,
        seriesType: "Area",
        topColor: "rgba(168, 85, 247, 0.6)",
        bottomColor: "rgba(168, 85, 247, 0.1)",
        title: "BTC + ETH",
      },
      // Top layer: OTHERS (Green - grows in alt-season)
      {
        data: detailedTotalData,
        color: "rgba(34, 197, 94, 0.8)",
        lineWidth: 2,
        seriesType: "Area",
        topColor: "rgba(34, 197, 94, 0.6)",
        bottomColor: "rgba(34, 197, 94, 0.1)",
        title: "Total Market Cap",
      },
    ];
  }, [detailedBtcData, detailedBtcEthData, detailedTotalData]);

  // Condensed chart (sparkline for card)
  const condensedChart = React.useMemo(() => {
    return (
      <LightweightChart
        data={sparklineData}
        height={80}
        seriesType="Line"
        colors={{ lineColor: "rgba(59, 130, 246, 0.8)" }}
        priceLineVisible={false}
        lastValueVisible={false}
        timeScaleVisible={false}
        priceScaleVisible={false}
      />
    );
  }, [sparklineData]);

  // Detailed chart (modal view)
  const detailedChart = React.useMemo(() => {
    return (
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex gap-2 flex-wrap">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Bitcoin</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span>Ethereum</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Altcoins</span>
          </div>
        </div>

        {/* Chart */}
        <LightweightChart
          data={[]} // Empty - using extraSeries
          height={400}
          extraSeries={extraSeries}
          priceFormat={{
            type: "custom",
            formatter: (price: number) => `$${formatLargeNumber(price)}`,
          }}
        />
      </div>
    );
  }, [timeframe, extraSeries]);

  // Sidebar content for metrics
  const sidebarContent = React.useMemo(() => {
    if (!latestMetrics) return null;

    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Total Market Cap</h3>
          <p className="text-2xl font-bold">${formatLargeNumber(latestMetrics.totalMcap)}</p>
        </div>
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-blue-500">BTC Dominance</span>
              <span className="font-medium">{latestMetrics.btcDominance.toFixed(2)}%</span>
            </div>
            <div className="w-full bg-secondary h-2 rounded-full mt-1">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${latestMetrics.btcDominance}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-purple-500">ETH Dominance</span>
              <span className="font-medium">{latestMetrics.ethDominance.toFixed(2)}%</span>
            </div>
            <div className="w-full bg-secondary h-2 rounded-full mt-1">
              <div
                className="bg-purple-500 h-2 rounded-full"
                style={{ width: `${latestMetrics.ethDominance}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-green-500">Others</span>
              <span className="font-medium">{latestMetrics.othersDominance.toFixed(2)}%</span>
            </div>
            <div className="w-full bg-secondary h-2 rounded-full mt-1">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{ width: `${latestMetrics.othersDominance}%` }}
              />
            </div>
          </div>
        </div>
        <div className="pt-2 border-t">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">BTC Dominance Stats</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Mean:</span>
              <span className="ml-1 font-medium">{btcDomStats.avg.toFixed(2)}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">Current:</span>
              <span className="ml-1 font-medium">{btcDomStats.current.toFixed(2)}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">Min:</span>
              <span className="ml-1 font-medium">{btcDomStats.min.toFixed(2)}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">Max:</span>
              <span className="ml-1 font-medium">{btcDomStats.max.toFixed(2)}%</span>
            </div>
          </div>
        </div>
      </div>
    );
  }, [latestMetrics, btcDomStats]);

  if (error) {
    return (
      <ExpandableChartCard
        id="crypto-dominance"
        title="Crypto Dominance"
        subtitle="Market leadership tracking"
        condensedChart={<div className="h-20" />}
        detailedChart={<div className="h-96" />}
        isLoading={false}
      />
    );
  }

  return (
    <ExpandableChartCard
      id="crypto-dominance"
      title="Crypto Dominance"
      subtitle={
        latestMetrics
          ? `BTC: ${latestMetrics.btcDominance.toFixed(1)}% | ETH: ${latestMetrics.ethDominance.toFixed(1)}% | Others: ${latestMetrics.othersDominance.toFixed(1)}%`
          : "Market leadership tracking"
      }
      metricValue={latestMetrics ? `${latestMetrics.btcDominance.toFixed(2)}%` : "N/A"}
      metricChange={latestMetrics ? btcDomStats.percentChange : 0}
      changeLabel="Change"
      variant={latestMetrics && latestMetrics.btcDominance < 45 ? "success" : "default"}
      condensedChart={condensedChart}
      detailedChart={detailedChart}
      sidebarContent={sidebarContent}
      isLoading={isLoading}
    />
  );
}
