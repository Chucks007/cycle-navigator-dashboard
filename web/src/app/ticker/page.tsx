"use client";

import * as React from "react";
import { Suspense } from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogScaleToggle, TimeframeSelector, type Timeframe } from "@/components/charts/chart-controls";
import {
  useStockMetrics,
  useStockHistory,
  useStockIndicators,
  useSentiment,
} from "@/hooks/use-data";
import { cn } from "@/lib/utils";
import {
  transformToLineDataWithKey,
  transformToOHLCData,
  transformToHistogramData,
  toChartTime,
  type ChartDataPoint,
  type OHLCDataPoint,
  type HistogramDataPoint,
} from "@/lib/chart-utils";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Chart Type Toggle Component
interface ChartTypeToggleProps {
  value: "line" | "candlestick";
  onChange: (value: "line" | "candlestick") => void;
}

function ChartTypeToggle({ value, onChange }: ChartTypeToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg border p-1 bg-muted/50">
      <button
        onClick={() => onChange("line")}
        className={cn(
          "px-3 py-1 text-xs font-medium rounded-md transition-all",
          value === "line"
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Line
      </button>
      <button
        onClick={() => onChange("candlestick")}
        className={cn(
          "px-3 py-1 text-xs font-medium rounded-md transition-all",
          value === "candlestick"
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Candles
      </button>
    </div>
  );
}

// Sentiment Gauge Component
interface SentimentGaugeProps {
  score: number;
  label: string;
}

function SentimentGauge({ score, label }: SentimentGaugeProps) {
  // Score from 1-5, normalize to 0-100
  const normalized = ((score - 1) / 4) * 100;
  
  let color = "bg-muted";
  let textColor = "text-muted-foreground";
  
  if (score >= 4) {
    color = "bg-emerald-500";
    textColor = "text-emerald-500";
  } else if (score >= 3) {
    color = "bg-yellow-500";
    textColor = "text-yellow-500";
  } else if (score >= 2) {
    color = "bg-orange-500";
    textColor = "text-orange-500";
  } else {
    color = "bg-red-500";
    textColor = "text-red-500";
  }
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn("text-sm font-medium", textColor)}>
          {score.toFixed(1)} / 5
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted/30 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${normalized}%` }}
        />
      </div>
    </div>
  );
}

// Technical Indicator Display
interface IndicatorDisplayProps {
  name: string;
  value: number | string;
  signal?: "buy" | "sell" | "neutral";
  description?: string;
}

function IndicatorDisplay({ name, value, signal, description }: IndicatorDisplayProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/10 border border-border/50">
      <div>
        <span className="font-medium">{name}</span>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono">{typeof value === "number" ? value.toFixed(2) : value}</span>
        {signal && (
          <Badge
            variant={signal === "buy" ? "default" : signal === "sell" ? "destructive" : "secondary"}
          >
            {signal.toUpperCase()}
          </Badge>
        )}
      </div>
    </div>
  );
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
  const initialTicker = searchParams.get("symbol") || "AAPL";
  const [ticker, setTicker] = React.useState(initialTicker);
  const [inputValue, setInputValue] = React.useState(initialTicker);
  const [timeframe, setTimeframe] = React.useState<Timeframe>("6M"); // Default to 6M to match previous subtitle intent

  const timeframeConfig = {
    "1D": { period: "1d", interval: "1m" },
    "1W": { period: "5d", interval: "15m" },
    "1M": { period: "1mo", interval: "60m" },
    "6M": { period: "6mo", interval: "1d" },
    "1Y": { period: "1y", interval: "1d" },
    "5Y": { period: "5y", interval: "1wk" },
    "ALL": { period: "max", interval: "1mo" },
  };

  const { period, interval } = timeframeConfig[timeframe];

  // Sync state when URL changes
  React.useEffect(() => {
    const currentSymbol = searchParams.get("symbol") || "AAPL";
    if (currentSymbol !== ticker) {
      setTicker(currentSymbol);
      setInputValue(currentSymbol);
    }
  }, [searchParams, ticker]);

  // Fetch data
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useStockMetrics(ticker);
  const { data: history, isLoading: historyLoading } = useStockHistory(ticker, period, interval);
  const { data: indicators, isLoading: indicatorsLoading } = useStockIndicators(ticker, period, interval);
  const { data: sentiment, isLoading: sentimentLoading } = useSentiment(ticker);

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
  const [chartType, setChartType] = React.useState<"line" | "candlestick">("line");
  const [logScale, setLogScale] = React.useState(false);

  // Transform history data for LightweightChart
  const lineChartData = React.useMemo((): ChartDataPoint[] => {
    if (!history) return [];
    return history
      .slice()
      .sort((a, b) => new Date(a.Datetime).getTime() - new Date(b.Datetime).getTime())
      .map((point) => ({
        time: toChartTime(point.Datetime),
        value: point.Close,
      }));
  }, [history]);

  // OHLC data for candlestick chart
  const ohlcChartData = React.useMemo((): OHLCDataPoint[] => {
    if (!history) return [];
    return transformToOHLCData(history);
  }, [history]);

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
      }));
  }, [history]);

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
      <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-xl p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent" />
        <div className="relative z-10">
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
        </div>
      </div>

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
          </>
        )}
      </div>

      {/* Charts Section */}
      <section id="price">
        <Tabs defaultValue="price" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="price">Price History</TabsTrigger>
            <TabsTrigger value="volume">Volume</TabsTrigger>
          </TabsList>

        <TabsContent value="price">
          <ExpandableChartCard
            id="price-history"
            title={`${ticker} Price History`}
            subtitle={
              timeframe === "ALL" 
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
                color={isPositive ? "#10b981" : "#ef4444"}
                height={160}
              />
            }
            detailedChart={
              chartType === "candlestick" && ohlcChartData.length > 0 ? (
                <LightweightChart
                  ohlcData={ohlcChartData}
                  seriesType="Candlestick"
                  logScale={logScale}
                  height={400}
                  fitContent
                />
              ) : (
                <LightweightChart
                  data={lineChartData}
                  seriesType="Area"
                  colors={{
                    lineColor: isPositive ? "#10b981" : "#ef4444",
                    topColor: isPositive ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)",
                    bottomColor: "transparent",
                  }}
                  logScale={logScale}
                  height={400}
                  fitContent
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
                  <LogScaleToggle checked={logScale} onChange={setLogScale} />
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
      </Tabs>
      </section>

      {/* Technical Indicators & Sentiment */}
      <section id="indicators">
        <div className="grid gap-6 lg:grid-cols-2">
        {/* Technical Indicators */}
        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-xl p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent" />
          <div className="relative z-10 space-y-4">
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
        </div>

        {/* Sentiment Analysis */}
        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-xl p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent" />
          <div className="relative z-10 space-y-4">
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
        </div>
        </div>
      </section>

      {/* Fundamentals Section - Placeholder */}
      <section id="fundamentals">
        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-xl p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent" />
          <div className="relative z-10">
            <h3 className="text-lg font-semibold mb-4">Fundamentals</h3>
            <p className="text-muted-foreground text-center py-8">
              Fundamental analysis coming soon...
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
