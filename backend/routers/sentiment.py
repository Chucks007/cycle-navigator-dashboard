import logging

from fastapi import APIRouter

from .. import schemas
from ..services.sentiment import fetch_news_sentiment
from ..utils import handle_api_errors
from .utils import ERROR_RESPONSES

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/sentiment",
    tags=["Sentiment"]
)

@router.get("/{ticker}", response_model=schemas.SentimentResponse, responses=ERROR_RESPONSES)
@handle_api_errors
def get_sentiment(ticker: str):
    """
    Get news sentiment analysis for a stock ticker.
    Returns sentiment score, label, and recent headlines with individual scores.
    """
    sentiment_data = fetch_news_sentiment(ticker)
    return sentiment_data
