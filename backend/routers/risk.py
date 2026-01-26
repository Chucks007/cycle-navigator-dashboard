import logging

from fastapi import APIRouter

from .. import schemas
from ..services import risk as risk_service
from ..utils import handle_api_errors
from .utils import ERROR_RESPONSES

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/risk",
    tags=["Risk"]
)

@router.get("/{ticker}", response_model=schemas.RiskResponse, responses=ERROR_RESPONSES)
@handle_api_errors
def get_risk_data(ticker: str):
    """
    Get full risk data including logarithmic regression bands for an asset.
    
    Returns risk score (0.0-1.0), fair value bands, and current price position.
    Best used for charting with band overlays.
    
    Supported tickers: BTC, ETH (and their -USD variants)
    """
    result = risk_service.get_risk_data(ticker)
    return result


@router.get("/{ticker}/score", response_model=schemas.RiskScoreResponse, responses=ERROR_RESPONSES)
@handle_api_errors
def get_risk_score(ticker: str):
    """
    Get lightweight risk score data for an asset (faster, for dashboard cards).
    
    Returns just the risk score, current band, price, and fair value.
    """
    result = risk_service.get_risk_score_only(ticker)
    return result
