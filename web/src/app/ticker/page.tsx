"use client";

import * as React from "react";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Gauge,
} from "lucide-react";
import { ChartSkeleton } from "@/components/charts/synced-chart";
import { ExpandableChartCard } from "@/components/charts/expandable-chart-card";
import { LightweightChart, SparklineChart } from "@/components/charts/lightweight-chart";
import { MetricCard, MetricCardSkeleton } from "@/components/ui/metric-card";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LogScaleToggle,
  TimeframeSelector,
  RegressionBandsToggle,
  PurchasingPowerModeSelector,
} from "@/components/charts/chart-controls";
import {
  useStockFundamentals,
  useStockHistoryWithPurchasingPower,
  useStockIndicators,
  useStockMetrics,
} from "@/hooks/use-stock-data";
import { useMacroSeries } from "@/hooks/use-macro-data";
import { useSentiment } from "@/hooks/use-sentiment-data";
import { useRiskData } from "@/hooks/use-risk-data";
import {
  transformToLineDataWithKey,
  transformToHistogramData,
  transformRiskBandsToSeries,
  transformMacroSeriesToOverlays,
  toChartTime,
  type ChartDataPoint,
  type OHLCDataPoint,
  type HistogramDataPoint,
  type ExtraSeriesConfig,
} from "@/lib/transformations";
import { RiskScoreCard, RiskChart } from "@/components/charts/risk-chart";
import { useTickerPreferences, timeframeToPeriodInterval } from "@/stores/ticker-preferences";
import { ChartTypeToggle } from "@/components/features/ticker/chart-toggle";
import { SentimentGauge } from "@/components/features/ticker/sentiment-gauge";
import { IndicatorDisplay } from "@/components/features/ticker/indicator-display";
import { FinancialsTable } from "@/components/features/ticker/financials-table";
import { OverlaySelector } from "@/components/features/ticker/overlay-selector";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TickerAnalysisPage() {
  return (
    <Suspense fallback={<TickerPageSkeleton />}>
      <TickerAnalysisContent />
    </Suspense>
  );
}

function TickerPageSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="h-8 w-8" />
          Ticker Analysis
        </h1>
        <p className="text-muted-foreground mt-1">Loading...</p>
      </div>
      <div className="h-10 w-full max-w-md bg-muted/20 animate-pulse rounded-lg" />
      <div className="h-32 w-full bg-muted/20 animate-pulse rounded-xl" />
    </div>
  );
}

function TickerAnalysisContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTicker = searchParams.get("symbol") || "BTC-USD";
  const [ticker, setTicker] = React.useState(initialTicker);
  const [inputValue, setInputValue] = React.useState(initialTicker);
  
  // Get preferences from Zustand store (persisted)
  const {
    timeframe,
    setTimeframe,
    chartType,
    setChartType,
    logScale: useLogScale,
    setLogScale: setUseLogScale,
    showRiskBands,
    setShowRiskBands,
    purchasingPowerMode,
    setPurchasingPowerMode,
  } = useTickerPreferences();

  // Macro overlay state
  const [selectedOverlays, setSelectedOverlays] = React.useState<string[]>([]);

  // Use the utility function for period/interval mapping
  const { period, interval } = timeframeToPeriodInterval(timeframe);

  // Convert timeframe to days for API calls (overlays, purchasing power helpers)
  const overlayDays = React.useMemo(() => {
    const daysMap: Record<string, number | undefined> = {
      "1D": 30,
      "5D": 60,
      "1M": 90,
      "3M": 180,
      "6M": 365,
      "1Y": 730,
      "5Y": 1825,
      ALL: undefined,
    };
    return daysMap[timeframe] ?? 365;
  }, [timeframe]);

  // Sync state when URL changes
  React.useEffect(() => {
    // Default to BTC-USD if no symbol provided
    const currentSymbol = searchParams.get("symbol") || "BTC-USD";
    if (currentSymbol !== ticker) {
      setTicker(currentSymbol);
      setInputValue(currentSymbol);
    }
  }, [searchParams, ticker]);

  // Fetch data
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useStockMetrics(ticker);
  const {
    data: history,
    isLoading: historyLoading,
    adjustedLineData,
    adjustedOHLCData,
    adjustmentLabel,
    isIndexed,
    isAdjusting,
  } = useStockHistoryWithPurchasingPower({
    ticker,
    period,
    interval,
    purchasingPowerMode,
    days: overlayDays,
  });
  const { data: indicators, isLoading: indicatorsLoading } = useStockIndicators(ticker, period, interval);
  const { data: sentiment, isLoading: sentimentLoading } = useSentiment(ticker);
  const { data: fundamentals, isLoading: fundamentalsLoading, error: fundamentalsError } = useStockFundamentals(ticker);

  // Risk Data (Only relevant for BTC/ETH, but safe to call for others - handles errors gracefully)
  const isCrypto = ticker === "BTC" || ticker === "ETH" || ticker === "BTC-USD" || ticker === "ETH-USD";
  const { data: riskData } = useRiskData(ticker, isCrypto); // Always fetch if crypto, control visibility with state

  const { data: macroSeriesData } = useMacroSeries(selectedOverlays, overlayDays);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const newTicker = inputValue.toUpperCase().trim();
    if (newTicker) {
      router.push(`/ticker?symbol=${newTicker}`);
    }
  };

  // Calculate price change
  const priceChange = metrics?.change || 0;
  const priceChangePct = metrics?.pct_change || 0;
  const isPositive = priceChange >= 0;

  // Chart view state
  // const [chartType, setChartType] = React.useState<"line" | "candlestick">("line"); // Removed: Duplicate
  // const [logScale, setLogScale] = React.useState(false); // Removed: Duplicate / renamed to useLogScale

  // Convert adjusted data to chart-compatible format
  const lineChartData = React.useMemo((): ChartDataPoint[] => {
    return adjustedLineData
      .map((point) => ({
        time: toChartTime(point.date),
        value: point.value,
      }))
      .filter((point): point is ChartDataPoint => point.time !== null && isFinite(point.value));
  }, [adjustedLineData]);

  // OHLC data for candlestick chart (uses adjusted data when mode != NOMINAL)
  const ohlcChartData = React.useMemo((): OHLCDataPoint[] => {
    const source = adjustedOHLCData.length > 0 ? adjustedOHLCData : [];
    return source
      .map((p) => ({
        time: toChartTime(p.date),
        open: p.open,
        high: p.high,
        low: p.low,
        close: p.close,
      }))
      .filter((item): item is OHLCDataPoint => item.time !== null);
  }, [adjustedOHLCData]);

  // Volume data for histogram
  const volumeChartData = React.useMemo((): HistogramDataPoint[] => {
    if (!history) return [];
    return transformToHistogramData(
      history,
      "Volume",
      (item) => {
        // Color based on price movement
        const isUp = item.Close >= item.Open;
        return isUp ? "rgba(34, 197, 94, 0.6)" : "rgba(239, 68, 68, 0.6)";
      }
    );
  }, [history]);

  // Sparkline data (last 30 points)
  const sparklineData = React.useMemo((): ChartDataPoint[] => {
    return lineChartData.slice(-30);
  }, [lineChartData]);

  const volumeSparklineData = React.useMemo((): ChartDataPoint[] => {
    if (!history) return [];
    return history
      .slice(-30)
      .sort((a, b) => new Date(a.Datetime).getTime() - new Date(b.Datetime).getTime())
      .map((point) => ({
        time: toChartTime(point.Datetime),
        value: point.Volume,
      }))
      .filter((point): point is ChartDataPoint => point.time !== null && isFinite(point.value));
  }, [history]);

  // Risk Bands Series
  const riskBandSeries = React.useMemo(() => {
    if (!riskData?.bands || !showRiskBands) return [];
    return transformRiskBandsToSeries(riskData.bands, {
      lineWidth: 1,
      showLabels: false,
      opacity: 0.15, // Low opacity so bands don't obscure price action
    });
  }, [riskData, showRiskBands]);

  // Macro Overlay Series (M2, CPI, etc.) - placed on left axis
  const macroOverlaySeries = React.useMemo((): ExtraSeriesConfig[] => {
    if (!macroSeriesData?.series || macroSeriesData.series.length === 0) return [];
    return transformMacroSeriesToOverlays(macroSeriesData.series, {
      priceScaleId: "left",
      showLabels: true,
    });
  }, [macroSeriesData]);

  // Combined extra series (risk bands + macro overlays)
  const combinedExtraSeries = React.useMemo((): ExtraSeriesConfig[] => {
    return [...riskBandSeries, ...macroOverlaySeries];
  }, [riskBandSeries, macroOverlaySeries]);

  // Price formatting - memoized to prevent chart re-renders
  const priceFormat = React.useMemo(() => {
    if (isIndexed) {
      // Indexed mode: show 1 decimal with "Index" label in tooltip
      return {
        type: 'price' as const,
        precision: 1,
        minMove: 0.1,
        formatter: (price: number) => `${price.toFixed(1)} (Index)`,
      };
    }
    if (isCrypto) {
      return { type: 'price' as const, precision: 1, minMove: 0.1 };
    }
    return { type: 'price' as const, precision: 2, minMove: 0.01 };
  }, [isCrypto, isIndexed]);

  // Chart colors - memoized to prevent unnecessary re-draws on UI changes
  const chartColors = React.useMemo(() => ({
    lineColor: isPositive ? "#10b981" : "#ef4444",
    topColor: isPositive ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)",
    bottomColor: "transparent",
  }), [isPositive]);

  // Sparkline color - memoized for performance
  const sparklineColor = React.useMemo(() => 
    isPositive ? "#10b981" : "#ef4444"
  , [isPositive]);

  if (metricsError) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-8 w-8" />
            Ticker Analysis
          </h1>
        </div>
        
        <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter ticker symbol..."
            className="font-mono uppercase"
          />
          <Button type="submit">
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </form>

        <div className="flex flex-col items-center justify-center h-[40vh] text-destructive">
          <AlertTriangle className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">Failed to load data for {ticker}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Make sure the ticker symbol is valid and the backend is running
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="h-8 w-8" />
          Ticker Analysis
        </h1>
        <p className="text-muted-foreground mt-1">
          Deep dive into individual stock metrics, technicals, and sentiment
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter ticker symbol..."
          className="font-mono uppercase"
        />
        <Button type="submit">
          <Search className="h-4 w-4 mr-2" />
          Search
        </Button>
      </form>

      {/* Main Ticker Card */}
      <DashboardCard className="p-6">
          {metricsLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-10 w-32 bg-muted/30 rounded" />
              <div className="h-6 w-48 bg-muted/20 rounded" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-2">
                <h2 className="text-4xl font-bold font-mono">{ticker}</h2>
                <Badge variant="outline" className="text-sm">
                  Stock
                </Badge>
              </div>
              <p className="text-lg text-muted-foreground mb-4">
                {ticker}
              </p>
              <div className="flex items-center gap-4">
                <span className="text-3xl font-bold">
                  ${metrics?.last_close?.toFixed(2) || "—"}
                </span>
                <div
                  className={cn(
                    "flex items-center gap-1 text-lg font-medium",
                    isPositive ? "text-emerald-500" : "text-red-500"
                  )}
                >
                  {isPositive ? (
                    <TrendingUp className="h-5 w-5" />
                  ) : (
                    <TrendingDown className="h-5 w-5" />
                  )}
                  {isPositive ? "+" : ""}{priceChange.toFixed(2)} ({priceChangePct.toFixed(2)}%)
                </div>
              </div>
            </>
          )}
      </DashboardCard>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricsLoading ? (
          Array(4).fill(0).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : (
          <>
            <MetricCard
              title="Day High"
              value={metrics?.high ? `$${metrics.high.toFixed(2)}` : "—"}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <MetricCard
              title="Day Low"
              value={metrics?.low ? `$${metrics.low.toFixed(2)}` : "—"}
              icon={<TrendingDown className="h-4 w-4" />}
            />
            <MetricCard
              title="Volatility"
              value={metrics?.volatility ? `${(metrics.volatility * 100).toFixed(2)}%` : "—"}
              subtitle="Annualized"
              icon={<Activity className="h-4 w-4" />}
              variant={
                metrics?.volatility
                  ? metrics.volatility > 0.5
                    ? "warning"
                    : "default"
                  : "default"
              }
            />
            <MetricCard
              title="Sharpe Ratio"
              value={metrics?.sharpe_ratio?.toFixed(2) || "—"}
              subtitle="Risk-adjusted return"
              icon={<Gauge className="h-4 w-4" />}
              variant={metrics?.sharpe_ratio && metrics.sharpe_ratio > 1 ? "success" : "default"}
            />
            {/* Risk Score Card (if available) */}
            {isCrypto && <RiskScoreCard ticker={ticker} />}
          </>
        )}
      </div>

      {/* Charts Section */}
      <section id="price">
        <Tabs defaultValue="price" className="w-full">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <TabsList>
              <TabsTrigger value="price">Price History</TabsTrigger>
              <TabsTrigger value="volume">Volume</TabsTrigger>
              {isCrypto && <TabsTrigger value="risk">Risk Model</TabsTrigger>}
            </TabsList>

            <div className="flex flex-wrap items-center gap-2">
              <TimeframeSelector value={timeframe} onChange={setTimeframe} />
              <ChartTypeToggle value={chartType} onChange={setChartType} />
              <LogScaleToggle checked={useLogScale} onChange={setUseLogScale} />
              <PurchasingPowerModeSelector 
                value={purchasingPowerMode} 
                onChange={setPurchasingPowerMode}
                disabled={isAdjusting}
              />
            </div>
          </div>

        <TabsContent value="price">
          <ExpandableChartCard
            id="price-history"
            title={`${ticker} Price History${adjustmentLabel}`}
            subtitle={
              isIndexed
                ? `Indexed to 100 at start of period${adjustmentLabel}`
                : timeframe === "ALL" 
                  ? "All available trading data" 
                  : `Trading data for the last ${timeframe}`
            }
            metricValue={metrics?.last_close ? `$${metrics.last_close.toFixed(2)}` : undefined}
            metricChange={priceChangePct}
            changeLabel="Day"
            variant={isPositive ? "success" : "danger"}
            isLoading={historyLoading}
            condensedChart={
              <SparklineChart
                data={sparklineData}
                color={sparklineColor}
                height={160}
              />
            }
            detailedChart={
              chartType === "candlestick" && ohlcChartData.length > 0 ? (
                <LightweightChart
                  ohlcData={ohlcChartData}
                  seriesType="Candlestick"
                  logScale={useLogScale}
                  height={400}
                  extraSeries={combinedExtraSeries}
                  fitContent
                  priceFormat={priceFormat}
                />
              ) : (
                <LightweightChart
                  data={lineChartData}
                  seriesType="Area"
                  colors={chartColors}
                  logScale={useLogScale}
                  height={400}
                  extraSeries={combinedExtraSeries}
                  fitContent
                  priceFormat={priceFormat}
                />
              )
            }
            modalActions={
              <div className="flex flex-col sm:flex-row items-center gap-4">
                 <TimeframeSelector value={timeframe} onChange={setTimeframe} />
                 <div className="hidden sm:block h-6 w-px bg-border/50" />
                 <div className="flex items-center gap-4">
                  <ChartTypeToggle value={chartType} onChange={setChartType} />
                  <div className="h-6 w-px bg-border/50" />
                  <LogScaleToggle checked={useLogScale} onChange={setUseLogScale} />
                  <div className="h-6 w-px bg-border/50" />
                  <PurchasingPowerModeSelector 
                    value={purchasingPowerMode} 
                    onChange={setPurchasingPowerMode}
                    disabled={isAdjusting}
                  />
                  <div className="h-6 w-px bg-border/50" />
                  <OverlaySelector
                    selectedOverlays={selectedOverlays}
                    onChange={setSelectedOverlays}
                  />
                  {isCrypto && (
                    <>
                      <div className="h-6 w-px bg-border/50" />
                      <RegressionBandsToggle 
                        checked={showRiskBands} 
                        onChange={setShowRiskBands}
                        disabled={!riskData}
                      />
                    </>
                  )}
                </div>
              </div>
            }
          />
        </TabsContent>

        <TabsContent value="volume">
          <ExpandableChartCard
            id="volume-chart"
            title={`${ticker} Trading Volume`}
            subtitle={
              timeframe === "ALL" 
                ? "All available volume data" 
                : `Volume data for the last ${timeframe}`
            }
            isLoading={historyLoading}
            condensedChart={
              <SparklineChart
                data={volumeSparklineData}
                color="hsl(var(--chart-2))"
                height={160}
              />
            }
            detailedChart={
              <LightweightChart
                data={volumeChartData}
                seriesType="Histogram"
                height={400}
                fitContent
              />
            }
            modalActions={
              <div className="flex items-center gap-4">
                 <TimeframeSelector value={timeframe} onChange={setTimeframe} />
              </div>
            }
          />
        </TabsContent>
        
        {isCrypto && (
          <TabsContent value="risk">
            <RiskChart ticker={ticker} />
          </TabsContent>
        )}
      </Tabs>
      </section>

      {/* Technical Indicators & Sentiment */}
      <section id="indicators">
        <div className="grid gap-6 lg:grid-cols-2">
        {/* Technical Indicators */}
        <DashboardCard className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Gauge className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Technical Indicators</h3>
            </div>
            {indicatorsLoading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/20" />
              ))
            ) : indicators && indicators.length > 0 ? (
              <div className="space-y-3">
                {(() => {
                  const latest = indicators[indicators.length - 1];
                  return (
                    <>
                      <IndicatorDisplay
                        name="RSI (14)"
                        value={latest.RSI_14 || 0}
                        signal={
                          latest.RSI_14
                            ? latest.RSI_14 > 70
                              ? "sell"
                              : latest.RSI_14 < 30
                              ? "buy"
                              : "neutral"
                            : undefined
                        }
                        description={
                          latest.RSI_14
                            ? latest.RSI_14 > 70
                              ? "Overbought"
                              : latest.RSI_14 < 30
                              ? "Oversold"
                              : "Neutral"
                            : undefined
                        }
                      />
                      <IndicatorDisplay
                        name="SMA 20"
                        value={latest.SMA_20 || 0}
                        signal={
                          metrics?.last_close && latest.SMA_20
                            ? metrics.last_close > latest.SMA_20
                              ? "buy"
                              : "sell"
                            : undefined
                        }
                      />
                      <IndicatorDisplay
                        name="EMA 20"
                        value={latest.EMA_20 || 0}
                        signal={
                          metrics?.last_close && latest.EMA_20
                            ? metrics.last_close > latest.EMA_20
                              ? "buy"
                              : "sell"
                            : undefined
                        }
                      />
                    </>
                  );
                })()}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No indicator data available
              </p>
            )}
          </div>
        </DashboardCard>

        {/* Sentiment Analysis */}
        <DashboardCard className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Sentiment Analysis</h3>
            </div>
            {sentimentLoading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/20" />
              ))
            ) : sentiment ? (
              <div className="space-y-4">
                <SentimentGauge
                  score={((sentiment.sentiment_score + 1) / 2) * 4 + 1} // Convert -1 to 1 range to 1-5
                  label={`Overall: ${sentiment.sentiment_label}`}
                />
                <div className="pt-4 border-t border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">News Count</span>
                    <Badge variant="secondary">{sentiment.news_count} articles</Badge>
                  </div>
                  {sentiment.headlines && sentiment.headlines.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <span className="text-sm text-muted-foreground">Recent Headlines</span>
                      {sentiment.headlines.slice(0, 3).map((headline, idx) => (
                        <a
                          key={idx}
                          href={headline.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm hover:text-primary truncate"
                        >
                          {headline.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No sentiment data available
              </p>
            )}
          </div>
        </DashboardCard>
        </div>
      </section>

      {/* Fundamentals Section */}
      <section id="fundamentals">
        <FinancialsTable
          data={fundamentals}
          isLoading={fundamentalsLoading}
          error={fundamentalsError}
          currentPrice={metrics?.last_close}
        />
      </section>
    </div>
  );
}
