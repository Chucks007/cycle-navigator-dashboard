import logging

from fastapi import APIRouter, Query

from .. import schemas
from ..services import macro_service
from ..utils import handle_api_errors
from .utils import ERROR_RESPONSES

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/macro",
    tags=["Macro"]
)


@router.get("/summary", response_model=schemas.MacroSummaryResponse, responses=ERROR_RESPONSES)
@handle_api_errors
def get_macro_summary(days: int = Query(None, description="Number of days of history to return")):
    """
    Returns all macro data (liquidity, debt status, real rates, CPI) in a single request.
    
    This endpoint is optimized for frontend dashboards that need multiple macro indicators.
    Instead of making 4 separate API calls, the frontend can fetch everything at once,
    reducing latency and preventing redundant database queries.
    
    The response includes a summary object with the latest values for quick display.
    """
    # Delegate to service layer for business logic
    summary_data = macro_service.get_dashboard_summary(days=days)
    return schemas.MacroSummaryResponse(**summary_data)


@router.get("/liquidity", response_model=schemas.LiquidityResponse, responses=ERROR_RESPONSES)
@handle_api_errors
def get_macro_liquidity(days: int = Query(None, description="Number of days of history to return")):
    """
    Returns historical M2 Money Supply and YoY % growth with metadata.
    Frontend should poll this endpoint periodically and check metadata.is_stale.
    """
    return macro_service.get_liquidity(days=days, include_metadata=True)


@router.get("/debt-status", response_model=schemas.DebtStatusResponse, responses=ERROR_RESPONSES)
@handle_api_errors
def get_macro_debt_status(days: int = Query(None, description="Number of days of history to return")):
    """
    Returns the Interest-to-Tax ratio and individual components with metadata.
    Frontend should poll this endpoint periodically and check metadata.is_stale.
    """
    return macro_service.get_debt_status(days=days, include_metadata=True)


@router.get("/real-rates", response_model=schemas.RealRatesResponse, responses=ERROR_RESPONSES)
@handle_api_errors
def get_macro_real_rates():
    """
    Returns (10-Year Treasury Yield - CPI Inflation Rate) with metadata.
    Frontend should poll this endpoint periodically and check metadata.is_stale.
    """
    return macro_service.get_real_rates(include_metadata=True)


@router.get("/cpi", response_model=schemas.CPIResponse, responses=ERROR_RESPONSES)
@handle_api_errors
def get_macro_cpi():
    """
    Returns historical CPI data with metadata.
    Frontend should poll this endpoint periodically and check metadata.is_stale.
    """
    return macro_service.get_cpi_series(include_metadata=True)
