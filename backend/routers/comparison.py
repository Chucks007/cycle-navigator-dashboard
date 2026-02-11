import logging

from fastapi import APIRouter, Query

from .. import schemas
from ..services.comparison import get_barbell_comparison
from ..utils import handle_api_errors
from .utils import ERROR_RESPONSES

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/comparison",
    tags=["Comparison"]
)

@router.get("/barbell", response_model=list[schemas.ComparisonResult], responses=ERROR_RESPONSES)
@handle_api_errors
def barbell_comparison_endpoint(period: str = Query("1y", description="Time period (e.g. 1y, ytd)")):
    """
    Fetch normalized comparison data for Barbell Strategy (Hard vs Soft Assets).
    """
    return get_barbell_comparison(period)
