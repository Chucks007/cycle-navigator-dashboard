import logging

from fastapi import APIRouter, Query

from .. import schemas
from ..services.common import format_for_api
from ..services.stock_service import stock_service
from ..utils import handle_api_errors
from .utils import ERROR_RESPONSES

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/stock",
    tags=["Stocks"]
)

@router.get("/{ticker}", response_model=schemas.StockMetrics, responses=ERROR_RESPONSES)
@handle_api_errors
def get_stock_metrics(
    ticker: str,
    period: str = Query("1d", description="Time period (e.g., 1d, 5d, 1mo)"),
    interval: str = Query("1m", description="Data interval (e.g., 1m, 5m, 1h)")
):
    data = stock_service.fetch_stock_data(ticker, period, interval)
    data = stock_service.process_data(data)
    rfr = stock_service.fetch_risk_free_rate()
    metrics = stock_service.calculate_metrics(data, rfr)
    return metrics


@router.get("/{ticker}/history", response_model=list[schemas.StockHistoryPoint], responses=ERROR_RESPONSES)
@handle_api_errors
def get_stock_history(
    ticker: str,
    period: str = Query("1d"),
    interval: str = Query("1m")
):
    data = stock_service.fetch_stock_data(ticker, period, interval)
    data = stock_service.process_data(data)
    # Rename for format_for_api which expects 'date' column
    data_formatted = data.rename(columns={'Datetime': 'date'})
    result_df = data_formatted[['date', 'Open', 'High', 'Low', 'Close', 'Volume']]
    result = format_for_api(result_df, date_format='%Y-%m-%d %H:%M:%S')
    # Rename back to Datetime to match schema
    for record in result:
        record['Datetime'] = record.pop('date')
    return result


@router.get("/{ticker}/indicators", response_model=list[schemas.StockIndicatorsPoint], responses=ERROR_RESPONSES)
@handle_api_errors
def get_stock_indicators(
    ticker: str,
    period: str = Query("1d"),
    interval: str = Query("1m")
):
    data = stock_service.fetch_stock_data(ticker, period, interval)
    data = stock_service.process_data(data)
    data = stock_service.add_technical_indicators(data)
    # Rename for format_for_api which expects 'date' column
    data_formatted = data.rename(columns={'Datetime': 'date'})
    # Filter columns that exist (some indicators might fail or be NaN)
    result_df = data_formatted[['date', 'SMA_20', 'EMA_20', 'RSI_14']]
    result = format_for_api(result_df, date_format='%Y-%m-%d %H:%M:%S')
    # Rename back to Datetime to match schema
    for record in result:
        record['Datetime'] = record.pop('date')
    return result


@router.get("/{ticker}/fundamentals", response_model=schemas.StockFundamentals, responses=ERROR_RESPONSES)
@handle_api_errors
def get_stock_fundamentals(ticker: str):
    """
    Fetch fundamental metrics for a stock.
    
    Returns valuation metrics (P/E, P/S), risk metrics (Beta, 52-week range),
    and profitability metrics (EPS, Profit Margin, Dividend Yield).
    """
    return stock_service.fetch_fundamentals(ticker)
