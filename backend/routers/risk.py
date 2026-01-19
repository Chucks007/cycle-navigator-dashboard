from fastapi import APIRouter, HTTPException
import logging
from requests.exceptions import ConnectionError, Timeout, RequestException

from .. import schemas
from ..services import risk as risk_service
from .utils import ERROR_RESPONSES

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/risk",
    tags=["Risk"]
)

@router.get("/{ticker}", response_model=schemas.RiskResponse, responses=ERROR_RESPONSES)
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


@router.get("/{ticker}/score", response_model=schemas.RiskScoreResponse, responses=ERROR_RESPONSES)
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
