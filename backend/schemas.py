
from pydantic import BaseModel

# --- Stock Data ---

class StockMetrics(BaseModel):
    last_close: float
    change: float
    pct_change: float
    high: float
    low: float
    volume: int
    volatility: float | None = None
    sharpe_ratio: float | None = None
    risk_free_rate: float


class StockFundamentals(BaseModel):
    """Fundamental metrics for stock valuation and risk analysis."""
    ticker: str
    name: str | None = None
    market_cap: float | None = None
    trailing_pe: float | None = None
    forward_pe: float | None = None
    beta: float | None = None
    fifty_two_week_high: float | None = None
    fifty_two_week_low: float | None = None
    dividend_yield: float | None = None
    trailing_eps: float | None = None
    profit_margin: float | None = None
    price_to_sales: float | None = None
    debt_to_equity: float | None = None
    sector: str | None = None
    industry: str | None = None


class StockHistoryPoint(BaseModel):
    Datetime: str
    Open: float
    High: float
    Low: float
    Close: float
    Volume: int

class StockIndicatorsPoint(BaseModel):
    Datetime: str
    SMA_20: float | None = None
    EMA_20: float | None = None
    EMA_21: float | None = None
    RSI_14: float | None = None

# --- Sentiment ---

class SentimentArticle(BaseModel):
    title: str
    link: str
    publisher: str
    score: float

class SentimentResponse(BaseModel):
    sentiment_score: float
    sentiment_label: str
    news_count: int
    headlines: list[SentimentArticle]
    message: str | None = None

# --- Macro ---

class LiquidityPoint(BaseModel):
    date: str
    value: float
    growth_rate: float | None = None

class DebtPoint(BaseModel):
    date: str
    interest_payments: float
    tax_receipts: float
    ratio: float

class RealRatePoint(BaseModel):
    date: str
    treasury_yield_10y: float
    cpi_inflation: float
    real_rate: float

class CPIPoint(BaseModel):
    date: str
    value: float

class MacroDataMetadata(BaseModel):
    """
    Metadata about macro data freshness.
    """
    last_updated: str | None = None  # ISO timestamp
    is_stale: bool = False

class LiquidityResponse(BaseModel):
    """Response with data and metadata for liquidity endpoint."""
    data: list[LiquidityPoint]
    metadata: MacroDataMetadata

class DebtStatusResponse(BaseModel):
    """Response with data and metadata for debt status endpoint."""
    data: list[DebtPoint]
    metadata: MacroDataMetadata

class RealRatesResponse(BaseModel):
    """Response with data and metadata for real rates endpoint."""
    data: list[RealRatePoint]
    metadata: MacroDataMetadata

class CPIResponse(BaseModel):
    """Response with data and metadata for CPI endpoint."""
    data: list[CPIPoint]
    metadata: MacroDataMetadata

class MacroMetrics(BaseModel):
    """
    Summary snapshot of macro metrics.
    """
    m2_supply: float
    m2_growth: float
    debt_to_tax_ratio: float
    real_rate: float


class MacroSummaryResponse(BaseModel):
    """
    Aggregated macro data response for efficient frontend fetching.
    Returns all macro indicators in a single request to prevent
    redundant API calls from multiple dashboard components.
    """
    liquidity: LiquidityResponse
    debt_status: DebtStatusResponse
    real_rates: RealRatesResponse
    cpi: CPIResponse
    summary: MacroMetrics


# --- Macro Series (for overlays) ---

class MacroSeriesPoint(BaseModel):
    """Single data point for a macro time series overlay."""
    date: str
    value: float


class MacroSeriesInfo(BaseModel):
    """Metadata about a single macro series."""
    series_id: str
    name: str
    description: str | None = None
    frequency: str  # e.g., "Monthly", "Daily", "Quarterly"
    units: str | None = None


class MacroSeriesData(BaseModel):
    """Response for a single macro series with data and metadata."""
    series_id: str
    name: str
    data: list[MacroSeriesPoint]
    metadata: MacroDataMetadata


class MacroSeriesResponse(BaseModel):
    """
    Response for macro series endpoint.
    Supports single or batch series requests for chart overlays.
    """
    series: list[MacroSeriesData]


class AvailableOverlaysResponse(BaseModel):
    """List of available macro series for overlay selection."""
    overlays: list[MacroSeriesInfo]


# --- Comparison / Barbell ---

class ComparisonPoint(BaseModel):
    date: str
    Hard_Index: float
    Soft_Index: float
    Ratio: float
    Ratio_Normalized: float

class ComparisonResult(ComparisonPoint):
    pass


# --- Risk / Regression Bands ---

class RiskBandValue(BaseModel):
    date: str
    value: float

class RiskBand(BaseModel):
    level: int
    name: str
    color: str
    std_multiplier: float
    values: list[RiskBandValue]

class CurrentBand(BaseModel):
    level: int
    name: str
    color: str

class RegressionParams(BaseModel):
    a: float
    b: float
    std: float

class RiskResponse(BaseModel):
    """Full risk data response with bands for charting."""
    ticker: str
    current_risk: float
    current_band: CurrentBand
    current_price: float
    fair_value: float
    bands: list[RiskBand]
    regression_params: RegressionParams
    inception_date: str
    data_points: int

class RiskScoreResponse(BaseModel):
    """Lightweight risk score response for dashboard cards."""
    ticker: str
    current_risk: float
    current_band: CurrentBand
    current_price: float
    fair_value: float


# --- Application Configuration ---

class TimeframeConfig(BaseModel):
    """Timeframe mapping for chart controls."""
    id: str
    label: str
    days: int | None  # None = ALL
    period: str  # yfinance period
    interval: str  # yfinance interval


class CacheConfig(BaseModel):
    """Cache TTL and staleness configuration."""
    ttl_seconds: int
    stale_threshold_hours: int


class ApiLimitsConfig(BaseModel):
    """API rate limit information."""
    fred_daily_limit: int
    coingecko_per_minute: int


class ChartDefaultsConfig(BaseModel):
    """Default chart settings."""
    sma_window: int
    ema_window: int
    rsi_window: int
    default_ticker: str
    default_tickers: list[str]


class AppConfigResponse(BaseModel):
    """
    Application configuration response.

    Exposes non-sensitive configuration to frontend for synchronization.
    This ensures frontend and backend use consistent settings.
    """
    version: str
    timeframes: list[TimeframeConfig]
    cache: CacheConfig
    api_limits: ApiLimitsConfig
    chart_defaults: ChartDefaultsConfig
    market_indices: list[dict]
    watchlist_tickers: list[str]

