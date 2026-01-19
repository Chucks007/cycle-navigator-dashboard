from fastapi import APIRouter, HTTPException, Query
from typing import List
import logging
from requests.exceptions import ConnectionError, Timeout, RequestException

from .. import schemas
from ..services.stock_service import stock_service
from ..services.common import format_for_api
from .utils import ERROR_RESPONSES

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/stock",
    tags=["Stocks"]
)

@router.get("/{ticker}", response_model=schemas.StockMetrics, responses=ERROR_RESPONSES)
def get_stock_metrics(
    ticker: str,
    period: str = Query("1d", description="Time period (e.g., 1d, 5d, 1mo)"),
    interval: str = Query("1m", description="Data interval (e.g., 1m, 5m, 1h)")
):
    try:
        data = stock_service.fetch_stock_data(ticker, period, interval)
        data = stock_service.process_data(data)
        rfr = stock_service.fetch_risk_free_rate()
        metrics = stock_service.calculate_metrics(data, rfr)
        return metrics
    except ValueError as e:
        logger.warning(f"Bad request for ticker {ticker}: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except (ConnectionError, Timeout, RequestException) as e:
        logger.error(f"Upstream error fetching {ticker}: {e}")
        raise HTTPException(status_code=502, detail=f"Upstream Provider Error: {str(e)}")
    except Exception as e:
        logger.exception(f"Unexpected error in get_stock_metrics for {ticker}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("/{ticker}/history", response_model=List[schemas.StockHistoryPoint], responses=ERROR_RESPONSES)
def get_stock_history(
    ticker: str,
    period: str = Query("1d"),
    interval: str = Query("1m")
):
    try:
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
    except ValueError as e:
        logger.warning(f"Bad request history {ticker}: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except (ConnectionError, Timeout, RequestException) as e:
        logger.error(f"Upstream error history {ticker}: {e}")
        raise HTTPException(status_code=502, detail=f"Upstream Provider Error: {str(e)}")
    except Exception as e:
        logger.exception(f"Unexpected error in get_stock_history for {ticker}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("/{ticker}/indicators", response_model=List[schemas.StockIndicatorsPoint], responses=ERROR_RESPONSES)
def get_stock_indicators(
    ticker: str,
    period: str = Query("1d"),
    interval: str = Query("1m")
):
    try:
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
    except ValueError as e:
        logger.warning(f"Bad request indicators {ticker}: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except (ConnectionError, Timeout, RequestException) as e:
        logger.error(f"Upstream error indicators {ticker}: {e}")
        raise HTTPException(status_code=502, detail=f"Upstream Provider Error: {str(e)}")
    except Exception as e:
        logger.exception(f"Unexpected error in get_stock_indicators for {ticker}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
