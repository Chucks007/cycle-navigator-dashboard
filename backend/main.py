from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List

from . import schemas
from .services import add_technical_indicators, calculate_metrics, fetch_stock_data, process_data, fetch_news_sentiment, fetch_risk_free_rate
from .macro_service import macro_service

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite default port
        "http://localhost:3000",  # Next.js default port
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/stock/{ticker}", response_model=schemas.StockMetrics)
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stock/{ticker}/history", response_model=List[schemas.StockHistoryPoint])
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stock/{ticker}/indicators", response_model=List[schemas.StockIndicatorsPoint])
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/sentiment/{ticker}", response_model=schemas.SentimentResponse)
def get_sentiment(ticker: str):
    """
    Get news sentiment analysis for a stock ticker.
    Returns sentiment score, label, and recent headlines with individual scores.
    """
    try:
        sentiment_data = fetch_news_sentiment(ticker)
        return sentiment_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Macro Analysis Endpoints

@app.get("/api/macro/liquidity", response_model=List[schemas.LiquidityPoint])
def get_macro_liquidity(days: int = Query(None, description="Number of days of history to return")):
    """
    Returns historical M2 Money Supply and YoY % growth.
    """
    try:
        return macro_service.get_liquidity(days=days)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching liquidity data: {str(e)}")

@app.get("/api/macro/debt-status", response_model=List[schemas.DebtPoint])
def get_macro_debt_status(days: int = Query(None, description="Number of days of history to return")):
    """
    Returns the Interest-to-Tax ratio and individual components.
    """
    try:
        return macro_service.get_debt_status(days=days)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching debt status: {str(e)}")

@app.get("/api/macro/real-rates", response_model=List[schemas.RealRatePoint])
def get_macro_real_rates():
    """
    Returns (10-Year Treasury Yield - CPI Inflation Rate).
    """
    try:
        return macro_service.get_real_rates()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching real rates: {str(e)}")

@app.get("/api/macro/cpi", response_model=List[schemas.CPIPoint])
def get_macro_cpi():
    """
    Returns historical CPI data.
    """
    try:
        return macro_service.get_cpi_series()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching CPI data: {str(e)}")

