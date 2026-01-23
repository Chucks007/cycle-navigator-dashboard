import logging

from fastapi import APIRouter, HTTPException, Query
from requests.exceptions import ConnectionError, RequestException, Timeout

from .. import schemas
from ..comparison_service import get_barbell_comparison
from .utils import ERROR_RESPONSES

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/comparison",
    tags=["Comparison"]
)

@router.get("/barbell", response_model=list[schemas.ComparisonResult], responses=ERROR_RESPONSES)
def barbell_comparison_endpoint(period: str = Query("1y", description="Time period (e.g. 1y, ytd)")):
    """
    Fetch normalized comparison data for Barbell Strategy (Hard vs Soft Assets).
    """
    try:
        return get_barbell_comparison(period)
    except ValueError as e:
        logger.warning(f"Bad request barbell: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except (ConnectionError, Timeout, RequestException) as e:
        logger.error(f"Upstream error barbell: {e}")
        raise HTTPException(status_code=502, detail=f"Upstream Provider Error: {str(e)}")
    except Exception as e:
        logger.exception("Unexpected error in get_barbell_comparison")
        raise HTTPException(status_code=500, detail=str(e))
