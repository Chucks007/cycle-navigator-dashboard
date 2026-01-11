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

class MacroMetrics(BaseModel):
    """
    Summary snapshot of macro metrics.
    """
    m2_supply: float
    m2_growth: float
    debt_to_tax_ratio: float
    real_rate: float

# --- Comparison / Barbell ---

class ComparisonPoint(BaseModel):
    date: str
    Hard_Index: float
    Soft_Index: float
    Ratio: float
    Ratio_Normalized: float

class ComparisonResult(ComparisonPoint):
    pass
