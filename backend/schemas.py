from pydantic import BaseModel
from typing import List, Optional

# --- Stock Data ---

class StockMetrics(BaseModel):
    last_close: float
    change: float
    pct_change: float
    high: float
    low: float
    volume: int
    volatility: Optional[float] = None
    sharpe_ratio: Optional[float] = None
    risk_free_rate: float

class StockHistoryPoint(BaseModel):
    Datetime: str
    Open: float
    High: float
    Low: float
    Close: float
    Volume: int

class StockIndicatorsPoint(BaseModel):
    Datetime: str
    SMA_20: Optional[float] = None
    EMA_20: Optional[float] = None
    EMA_21: Optional[float] = None
    RSI_14: Optional[float] = None

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
    headlines: List[SentimentArticle]
    message: Optional[str] = None

# --- Macro ---

class LiquidityPoint(BaseModel):
    date: str
    value: float
    growth_rate: Optional[float] = None

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
    last_updated: Optional[str] = None  # ISO timestamp
    is_stale: bool = False

class LiquidityResponse(BaseModel):
    """Response with data and metadata for liquidity endpoint."""
    data: List[LiquidityPoint]
    metadata: MacroDataMetadata

class DebtStatusResponse(BaseModel):
    """Response with data and metadata for debt status endpoint."""
    data: List[DebtPoint]
    metadata: MacroDataMetadata

class RealRatesResponse(BaseModel):
    """Response with data and metadata for real rates endpoint."""
    data: List[RealRatePoint]
    metadata: MacroDataMetadata

class CPIResponse(BaseModel):
    """Response with data and metadata for CPI endpoint."""
    data: List[CPIPoint]
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
    values: List[RiskBandValue]

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
    bands: List[RiskBand]
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
