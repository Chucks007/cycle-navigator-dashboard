import logging

from fastapi import APIRouter, HTTPException
from requests.exceptions import ConnectionError, RequestException, Timeout

from .. import schemas
from ..services.sentiment import fetch_news_sentiment
from .utils import ERROR_RESPONSES

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/sentiment",
    tags=["Sentiment"]
)

@router.get("/{ticker}", response_model=schemas.SentimentResponse, responses=ERROR_RESPONSES)
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
    except Exception:
        logger.exception(f"Unexpected error in get_sentiment for {ticker}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
