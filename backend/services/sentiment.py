import logging

from textblob import TextBlob

import backend.services as services

from .. import schemas

logger = logging.getLogger(__name__)

# --- Internal Helper Functions for News Fetching & Parsing ---

def _get_raw_stock_news(ticker: str):
    """
    Fetcher: Retrieves raw news objects from the yfinance API.
    Returns a list of news items (dicts) or empty list if failed/empty.
    """
    yf = services.get_yf()
    error = services.get_yf_import_error()
    if error is not None:
        # If we can't import yfinance, we can't get new data
        return []


    try:
        stock = yf.Ticker(ticker)
        # yfinance .news returns a list of dictionaries
        return stock.news
    except Exception as e:
        logger.error(f"Error fetching news for {ticker}: {e}")
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
    yf_error = services.get_yf_import_error()

    if not headlines:

        message = "No recent news found for this ticker."
        if yf_error:
            message = f"yfinance not available: {yf_error}"

        return schemas.SentimentResponse(
            sentiment_score=0.0,
            sentiment_label="Neutral",
            news_count=0,
            headlines=[],
            message=message
        )

    # Extract scores excluding failed analysis if any (though we default to 0.0)
    scores = [h['score'] for h in headlines]

    if not scores: # Should not happen if headlines is not empty
        return schemas.SentimentResponse(
            sentiment_score=0.0,
            sentiment_label="Neutral",
            headlines=[],
            news_count=0
        )

    avg_score = sum(scores) / len(scores)

    # Convert headlines (dicts) to SentimentArticle objects
    formatted_headlines = [
        schemas.SentimentArticle(
            title=h['title'],
            link=h['link'],
            publisher=h['publisher'],
            score=h['score']
        ) for h in headlines
    ]

    return schemas.SentimentResponse(
        sentiment_score=round(avg_score, 3),
        sentiment_label=get_sentiment_label(avg_score),
        news_count=len(headlines),
        headlines=formatted_headlines
    )

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
    
    Returns:
        schemas.SentimentResponse: A dictionary (or Pydantic model) containing:
        - sentiment_score (float): Average sentiment score.
        - sentiment_label (str): Bullish/Bearish/Neutral.
        - news_count (int): Number of articles analyzed.
        - headlines (List[SentimentArticle]): List of analyzed articles.
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
