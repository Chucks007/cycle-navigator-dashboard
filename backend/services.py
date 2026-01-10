import numpy as np
import pandas as pd
import ta
from textblob import TextBlob

from . import config
from .utils import get_yf, get_yf_import_error

# --- Internal Helper Functions for News Fetching & Parsing ---

def _get_raw_stock_news(ticker: str):
    """
    Fetcher: Retrieves raw news objects from the yfinance API.
    Returns a list of news items (dicts) or empty list if failed/empty.
    """
    yf = get_yf()
    error = get_yf_import_error()
    if error is not None:
        # If we can't import yfinance, we can't get new data
        return []

    try:
        stock = yf.Ticker(ticker)
        # yfinance .news returns a list of dictionaries
        return stock.news
    except Exception as e:
        print(f"Error fetching news for {ticker}: {e}")
        return []

def _parse_article_structure(article: dict) -> dict:
    """
    Parser: Normalizes yfinance news item structure into a flat internal format.
    Handles both nested 'content' dicts and flat test structures.
    """
    # 1. Try nested structure (standard yfinance response)
    if 'content' in article:
        content = article.get('content', {})
        title = content.get('title', '')
        
        # Link resolution
        canonical = content.get('canonicalUrl', {})
        click_through = content.get('clickThroughUrl', {})
        link = canonical.get('url', '') or click_through.get('url', '')
        
        # Publisher resolution
        provider_info = content.get('provider', {})
        publisher = provider_info.get('displayName', '')
        
    # 2. Fallback to flat structure (common in mocks or older API responses)
    else:
        title = article.get('title', '')
        link = article.get('link', '')
        publisher = article.get('publisher', '')

    return {
        "title": title,
        "link": link,
        "publisher": publisher
    }

def _analyze_article_sentiment(article: dict) -> dict:
    """
    Analyzer: scoring logic for a single article.
    Adds 'score' to the article dict.
    """
    title = article.get('title', '')
    if title:
        score = analyze_sentiment(title)
        article['score'] = round(score, 3)
    else:
        article['score'] = 0.0
    return article

def _format_sentiment_response(headlines: list, ticker: str) -> dict:
    """
    Formatter: Aggregates scores and builds the final response dictionary.
    """
    yf_error = get_yf_import_error()
    
    if not headlines:
        message = "No recent news found for this ticker."
        if yf_error:
            message = f"yfinance not available: {yf_error}"
            
        return {
            "sentiment_score": 0.0,
            "sentiment_label": "Neutral",
            "news_count": 0,
            "headlines": [],
            "message": message
        }

    # Extract scores excluding failed analysis if any (though we default to 0.0)
    scores = [h['score'] for h in headlines]
    
    if not scores: # Should not happen if headlines is not empty
        return {
            "sentiment_score": 0.0,
            "sentiment_label": "Neutral",
            "headlines": [],
            "news_count": 0
        }

    avg_score = sum(scores) / len(scores)
    
    return {
        "sentiment_score": round(avg_score, 3),
        "sentiment_label": get_sentiment_label(avg_score),
        "news_count": len(headlines),
        "headlines": headlines
    }

# --- Internal Helper Functions for Batch Prices ---

def _fetch_raw_batch_data(tickers: list) -> pd.DataFrame:
    """
    Fetcher: Downloads batch price data for multiple tickers.
    """
    yf = get_yf()
    if get_yf_import_error() is not None:
        raise Exception(f"yfinance not available: {get_yf_import_error()}")

    # Download batch data for 5 days to ensure we have previous close
    data = yf.download(tickers, period="5d", interval="1d", group_by='ticker', auto_adjust=False, progress=False)
    return data

def _calculate_batch_deltas(data: pd.DataFrame, tickers: list) -> dict:
    """
    Processor: Calculates price, delta, and pct_delta for each ticker from batch data.
    """
    results = {}
    for ticker in tickers:
        try:
            # Handle case where only one ticker is requested (structure is different)
            if len(tickers) == 1:
                ticker_data = data
            else:
                if ticker not in data.columns.levels[0]:
                    continue
                ticker_data = data[ticker]

            # Drop NaNs
            ticker_data = ticker_data.dropna()

            if len(ticker_data) < 2:
                # Not enough data for delta
                if len(ticker_data) == 1:
                        last_price = float(ticker_data['Close'].iloc[-1])
                        results[ticker] = {
                        "price": last_price,
                        "delta": 0.0,
                        "pct_delta": 0.0
                    }
                continue

            last_price = float(ticker_data['Close'].iloc[-1])
            prev_price = float(ticker_data['Close'].iloc[-2])

            delta = last_price - prev_price
            pct_delta = (delta / prev_price) * 100

            results[ticker] = {
                "price": last_price,
                "delta": delta,
                "pct_delta": pct_delta
            }
        except Exception:
            # Skip failures for individual tickers in batch
            continue
    return results

# --- Public Services ---

def fetch_stock_data(ticker: str, period: str, interval: str) -> pd.DataFrame:
    """
    Fetch stock data based on ticker, period, & interval through Yahoo Finance API.
    Raises Exception if data is empty or fetch fails.
    """
    yf = get_yf()
    error = get_yf_import_error()
    if error is not None:
         raise Exception(f"yfinance not available: {error}")

    try:
        if period == 'max':
            data = yf.download(ticker, period='max', interval=interval, auto_adjust=False)
        else:
            data = yf.download(ticker, period=period, interval=interval, auto_adjust=False)

        if data.empty:
            raise ValueError(f"No data found for {ticker}.")
        return data
    except Exception as e:
        raise Exception(f"Error fetching data: {e}")

def process_data(data: pd.DataFrame) -> pd.DataFrame:
    """
    Format the date & time to ensure it is timezone aware with correct formatting.
    """
    if data.index.tz is None:
        data.index = data.index.tz_localize('UTC')
    data.index = data.index.tz_convert('US/Eastern')
    data.reset_index(inplace=True)

    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)

    first_col = data.columns[0]
    if first_col != 'Datetime':
        data.rename(columns={first_col: 'Datetime'}, inplace=True)
    data['Datetime'] = pd.to_datetime(data['Datetime'])

    return data

def add_technical_indicators(data: pd.DataFrame, fill_na: bool = True) -> pd.DataFrame:
    """
    Add technical indicators (SMA, EMA, RSI).
    """
    close_prices = data['Close'].squeeze()

    data['SMA_20'] = ta.trend.sma_indicator(close_prices, window=config.SMA_WINDOW)
    data['EMA_20'] = ta.trend.ema_indicator(close_prices, window=config.EMA_WINDOW)
    data['RSI_14'] = ta.momentum.rsi(close_prices, window=config.RSI_WINDOW)

    if fill_na:
        data.fillna(0, inplace=True)
    return data

def fetch_risk_free_rate() -> float:
    """Fetches the current 10-Year Treasury Yield from yfinance."""
    error = get_yf_import_error()
    if error is not None:
        print(f"Unable to fetch risk-free rate because yfinance import failed: {error}. Using default rate.")
        return config.DEFAULT_RISK_FREE_RATE
    
    yf = get_yf()
    try:
        treasury = yf.Ticker("^TNX")
        hist = treasury.history(period="5d")
        if not hist.empty:
            rate = float(hist['Close'].iloc[-1]) / 100.0
            return rate
        return config.DEFAULT_RISK_FREE_RATE
    except Exception as e:
        print(f"Unable to fetch risk-free rate: {e}. Using default 4%.")
        return config.DEFAULT_RISK_FREE_RATE

def calculate_risk_metrics(data: pd.DataFrame, risk_free_rate: float = None) -> tuple:
    """
    Calculates Annualized Volatility and Sharpe Ratio.
    Does NOT call API. Pure calculation.
    """
    if risk_free_rate is None:
        risk_free_rate = config.DEFAULT_RISK_FREE_RATE
    
    if data is None or len(data) < 2:
        return np.nan, np.nan

    close_col = data['Close']
    if isinstance(close_col, pd.DataFrame):
        try:
            close_series = close_col.squeeze()
        except Exception:
            close_series = close_col.iloc[:, 0]
    else:
        close_series = close_col

    close_series = pd.to_numeric(close_series, errors='coerce')
    returns = close_series.pct_change().dropna()

    if len(returns) < 2:
        return np.nan, np.nan

    volatility = float(returns.std() * np.sqrt(config.TRADING_DAYS_PER_YEAR))
    annualized_return = float(returns.mean() * config.TRADING_DAYS_PER_YEAR)

    if volatility == 0 or np.isnan(volatility):
        sharpe = np.nan
    else:
        sharpe = float((annualized_return - risk_free_rate) / volatility)

    return volatility, sharpe

def calculate_metrics(data: pd.DataFrame, risk_free_rate: float) -> dict:
    """
    Calculate basic metrics from stock data.
    Takes risk_free_rate as input to avoid API calls inside a calculation function.
    """
    last_close = float(data['Close'].iloc[-1].item())
    prev_close = float(data['Close'].iloc[0].item())
    change = last_close - prev_close
    pct_change = (change / prev_close) * 100
    high = float(data['High'].max().item())
    low = float(data['Low'].min().item())
    volume = int(data['Volume'].sum().item())

    volatility, sharpe_ratio = calculate_risk_metrics(data, risk_free_rate)

    return {
        "last_close": last_close,
        "change": change,
        "pct_change": pct_change,
        "high": high,
        "low": low,
        "volume": volume,
        "volatility": volatility,
        "sharpe_ratio": sharpe_ratio,
        "risk_free_rate": risk_free_rate
    }

def analyze_sentiment(text: str) -> float:
    """
    Analyze sentiment of a text using TextBlob.
    """
    analysis = TextBlob(text)
    return analysis.sentiment.polarity

def get_sentiment_label(score: float) -> str:
    """
    Convert a sentiment score to a human-readable label.
    """
    if score > 0.1:
        return "Bullish"
    elif score < -0.1:
        return "Bearish"
    else:
        return "Neutral"

def fetch_news_sentiment(ticker: str) -> dict:
    """
    Orchestrator: Fetches, parses, analyzes, and formats news sentiment.
    """
    # 1. Fetch raw data
    raw_news = _get_raw_stock_news(ticker)
    
    # 2. Parse and Analyze
    # We define a pipeline here.
    # Take up to 10 articles
    articles = []
    
    # Check if raw_news is valid
    if raw_news:
         for item in raw_news[:10]:
            clean_item = _parse_article_structure(item)
            if clean_item['title']: # Only process if title exists
                analyzed_item = _analyze_article_sentiment(clean_item)
                articles.append(analyzed_item)
    
    # 3. Format result
    return _format_sentiment_response(articles, ticker)

def fetch_batch_prices(tickers: list) -> dict:
    """
    Orchestrator: Fetches batch data and calculates price deltas.
    """
    if not tickers:
        return {}

    try:
        raw_data = _fetch_raw_batch_data(tickers)
        results = _calculate_batch_deltas(raw_data, tickers)
        return results
    except Exception as e:
        raise Exception(f"Error fetching batch data: {e}")
