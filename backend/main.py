from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import pandas as pd
import numpy as np
import logging
from requests.exceptions import ConnectionError, Timeout, RequestException

from . import schemas
from . import config
from .services.stock import add_technical_indicators, calculate_metrics, fetch_stock_data, process_data, fetch_risk_free_rate
from .services.sentiment import fetch_news_sentiment
from .services import macro_service
from .services import market_service
from .services import risk as risk_service

from .comparison_service import fetch_normalized_comparison, calculate_hard_vs_soft_ratio, HARD_ASSETS, SOFT_ASSETS

logger = logging.getLogger(__name__)

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ERROR_RESPONSES = {
    400: {"description": "Invalid Request / Bad Input"},
    502: {"description": "Upstream Provider Error (FRED/Yahoo/Connectivity)"},
    500: {"description": "Internal Server Error"}
}

@app.get("/api/stock/{ticker}", response_model=schemas.StockMetrics, responses=ERROR_RESPONSES)
def get_stock_metrics(
    ticker: str,
    period: str = Query("1d", description="Time period (e.g., 1d, 5d, 1mo)"),
    interval: str = Query("1m", description="Data interval (e.g., 1m, 5m, 1h)")
):
    try:
        data = fetch_stock_data(ticker, period, interval)
        data = process_data(data)
        rfr = fetch_risk_free_rate()
        metrics = calculate_metrics(data, rfr)
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

@app.get("/api/stock/{ticker}/history", response_model=List[schemas.StockHistoryPoint], responses=ERROR_RESPONSES)
def get_stock_history(
    ticker: str,
    period: str = Query("1d"),
    interval: str = Query("1m")
):
    try:
        data = fetch_stock_data(ticker, period, interval)
        data = process_data(data)
        # Convert to records for JSON
        # We need Datetime as string
        data['Datetime'] = data['Datetime'].dt.strftime('%Y-%m-%d %H:%M:%S')
        result = data[['Datetime', 'Open', 'High', 'Low', 'Close', 'Volume']].to_dict(orient='records')
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

@app.get("/api/stock/{ticker}/indicators", response_model=List[schemas.StockIndicatorsPoint], responses=ERROR_RESPONSES)
def get_stock_indicators(
    ticker: str,
    period: str = Query("1d"),
    interval: str = Query("1m")
):
    try:
        data = fetch_stock_data(ticker, period, interval)
        data = process_data(data)
        data = add_technical_indicators(data)

        data['Datetime'] = data['Datetime'].dt.strftime('%Y-%m-%d %H:%M:%S')
        # Filter columns that exist (some indicators might fail or be NaN)
        cols = ['Datetime', 'SMA_20', 'EMA_20', 'RSI_14']
        result = data[cols].to_dict(orient='records')
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

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/sentiment/{ticker}", response_model=schemas.SentimentResponse, responses=ERROR_RESPONSES)
def get_sentiment(ticker: str):
    """
    Get news sentiment analysis for a stock ticker.
    Returns sentiment score, label, and recent headlines with individual scores.
    """
    try:
        sentiment_data = fetch_news_sentiment(ticker)
        return sentiment_data
    except ValueError as e:
         raise HTTPException(status_code=400, detail=str(e))
    except (ConnectionError, Timeout, RequestException) as e:
         raise HTTPException(status_code=502, detail=f"Upstream Provider Error: {str(e)}")
    except Exception as e:
        logger.exception(f"Unexpected error in get_sentiment for {ticker}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

# Macro Analysis Endpoints

@app.get("/api/macro/liquidity", response_model=List[schemas.LiquidityPoint], responses=ERROR_RESPONSES)
def get_macro_liquidity(days: int = Query(None, description="Number of days of history to return")):
    """
    Returns historical M2 Money Supply and YoY % growth.
    """
    try:
        return macro_service.get_liquidity(days=days)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (ConnectionError, Timeout, RequestException) as e:
        raise HTTPException(status_code=502, detail=f"Upstream Provider Error: {str(e)}")
    except Exception as e:
        logger.exception("Error fetching liquidity data")
        raise HTTPException(status_code=500, detail=f"Error fetching liquidity data: {str(e)}")

@app.get("/api/macro/debt-status", response_model=List[schemas.DebtPoint], responses=ERROR_RESPONSES)
def get_macro_debt_status(days: int = Query(None, description="Number of days of history to return")):
    """
    Returns the Interest-to-Tax ratio and individual components.
    """
    try:
        return macro_service.get_debt_status(days=days)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (ConnectionError, Timeout, RequestException) as e:
        raise HTTPException(status_code=502, detail=f"Upstream Provider Error: {str(e)}")
    except Exception as e:
        logger.exception("Error fetching debt status")
        raise HTTPException(status_code=500, detail=f"Error fetching debt status: {str(e)}")

@app.get("/api/macro/real-rates", response_model=List[schemas.RealRatePoint], responses=ERROR_RESPONSES)
def get_macro_real_rates():
    """
    Returns (10-Year Treasury Yield - CPI Inflation Rate).
    """
    try:
        return macro_service.get_real_rates()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (ConnectionError, Timeout, RequestException) as e:
        raise HTTPException(status_code=502, detail=f"Upstream Provider Error: {str(e)}")
    except Exception as e:
        logger.exception("Error fetching real rates")
        raise HTTPException(status_code=500, detail=f"Error fetching real rates: {str(e)}")

@app.get("/api/macro/cpi", response_model=List[schemas.CPIPoint], responses=ERROR_RESPONSES)
def get_macro_cpi():
    """
    Returns historical CPI data.
    """
    try:
        return macro_service.get_cpi_series()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (ConnectionError, Timeout, RequestException) as e:
        raise HTTPException(status_code=502, detail=f"Upstream Provider Error: {str(e)}")
    except Exception as e:
        logger.exception("Error fetching CPI data")
        raise HTTPException(status_code=500, detail=f"Error fetching CPI data: {str(e)}")


@app.get("/api/comparison/barbell", response_model=List[schemas.ComparisonResult], responses=ERROR_RESPONSES)
def get_barbell_comparison(period: str = Query("1y", description="Time period (e.g. 1y, ytd)")):
    """
    Fetch normalized comparison data for Barbell Strategy (Hard vs Soft Assets).
    """
    try:
        # 1. Fetch asset lists
        hard_tickers = list(HARD_ASSETS.keys())
        soft_tickers = list(SOFT_ASSETS.keys())
        all_tickers = hard_tickers + soft_tickers

        # 2. Call service to get normalized data
        _, normalized_df = fetch_normalized_comparison(all_tickers, period=period)

        # 3. Calculate indices and ratio
        ratio_df = calculate_hard_vs_soft_ratio(normalized_df, hard_tickers, soft_tickers)

        # 4. Format for response
        ratio_df = ratio_df.reset_index()
        # Rename Date -> date
        ratio_df.rename(columns={'Date': 'date'}, inplace=True)
        # Ensure we have a string date
        if 'date' in ratio_df.columns:
            ratio_df['date'] = ratio_df['date'].dt.strftime('%Y-%m-%d')
        else:
            # Fallback if index name is different or missing
            # It should be the first column after reset_index if unnamed
            ratio_df['date'] = ratio_df.iloc[:, 0].dt.strftime('%Y-%m-%d')
            
        # Select and validate fields
        result = ratio_df[['date', 'Hard_Index', 'Soft_Index', 'Ratio', 'Ratio_Normalized']].to_dict(orient='records')
        return result

    except ValueError as e:
        logger.warning(f"Bad request barbell: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except (ConnectionError, Timeout, RequestException) as e:
        logger.error(f"Upstream error barbell: {e}")
        raise HTTPException(status_code=502, detail=f"Upstream Provider Error: {str(e)}")
    except Exception as e:
        logger.exception("Unexpected error in get_barbell_comparison")
        raise HTTPException(status_code=500, detail=str(e))


# --- Risk / Regression Bands Endpoints ---

@app.get("/api/v1/risk/{ticker}", response_model=schemas.RiskResponse, responses=ERROR_RESPONSES)
def get_risk_data(ticker: str):
    """
    Get full risk data including logarithmic regression bands for an asset.
    
    Returns risk score (0.0-1.0), fair value bands, and current price position.
    Best used for charting with band overlays.
    
    Supported tickers: BTC, ETH (and their -USD variants)
    """
    try:
        result = risk_service.get_risk_data(ticker)
        return result
    except ValueError as e:
        logger.warning(f"Bad request risk {ticker}: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except (ConnectionError, Timeout, RequestException) as e:
        logger.error(f"Upstream error risk {ticker}: {e}")
        raise HTTPException(status_code=502, detail=f"Upstream Provider Error: {str(e)}")
    except Exception as e:
        logger.exception(f"Unexpected error in get_risk_data for {ticker}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@app.get("/api/v1/risk/{ticker}/score", response_model=schemas.RiskScoreResponse, responses=ERROR_RESPONSES)
def get_risk_score(ticker: str):
    """
    Get lightweight risk score data for an asset (faster, for dashboard cards).
    
    Returns just the risk score, current band, price, and fair value.
    """
    try:
        result = risk_service.get_risk_score_only(ticker)
        return result
    except ValueError as e:
        logger.warning(f"Bad request risk score {ticker}: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except (ConnectionError, Timeout, RequestException) as e:
        logger.error(f"Upstream error risk score {ticker}: {e}")
        raise HTTPException(status_code=502, detail=f"Upstream Provider Error: {str(e)}")
    except Exception as e:
        logger.exception(f"Unexpected error in get_risk_score for {ticker}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


