from fastapi import APIRouter, HTTPException, Query
from typing import List
import logging
from requests.exceptions import ConnectionError, Timeout, RequestException

from .. import schemas
from ..services import macro_service
from .utils import ERROR_RESPONSES

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/macro",
    tags=["Macro"]
)


@router.get("/summary", response_model=schemas.MacroSummaryResponse, responses=ERROR_RESPONSES)
def get_macro_summary(days: int = Query(None, description="Number of days of history to return")):
    """
    Returns all macro data (liquidity, debt status, real rates, CPI) in a single request.
    
    This endpoint is optimized for frontend dashboards that need multiple macro indicators.
    Instead of making 4 separate API calls, the frontend can fetch everything at once,
    reducing latency and preventing redundant database queries.
    
    The response includes a summary object with the latest values for quick display.
    """
    try:
        # Fetch all macro data
        liquidity = macro_service.get_liquidity(days=days, include_metadata=True)
        debt_status = macro_service.get_debt_status(days=days, include_metadata=True)
        real_rates = macro_service.get_real_rates(include_metadata=True)
        cpi = macro_service.get_cpi_series(include_metadata=True)
        
        # Calculate summary metrics from latest values
        latest_m2 = liquidity['data'][-1] if liquidity['data'] else None
        latest_debt = debt_status['data'][-1] if debt_status['data'] else None
        latest_rates = real_rates['data'][-1] if real_rates['data'] else None
        
        summary = schemas.MacroMetrics(
            m2_supply=latest_m2['value'] if latest_m2 else 0.0,
            m2_growth=latest_m2['growth_rate'] if latest_m2 and latest_m2.get('growth_rate') else 0.0,
            debt_to_tax_ratio=latest_debt['ratio'] if latest_debt else 0.0,
            real_rate=latest_rates['real_rate'] if latest_rates else 0.0,
        )
        
        return schemas.MacroSummaryResponse(
            liquidity=liquidity,
            debt_status=debt_status,
            real_rates=real_rates,
            cpi=cpi,
            summary=summary,
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (ConnectionError, Timeout, RequestException) as e:
        raise HTTPException(status_code=502, detail=f"Upstream Provider Error: {str(e)}")
    except Exception as e:
        logger.exception("Error fetching macro summary")
        raise HTTPException(status_code=500, detail=f"Error fetching macro summary: {str(e)}")

@router.get("/liquidity", response_model=schemas.LiquidityResponse, responses=ERROR_RESPONSES)
def get_macro_liquidity(days: int = Query(None, description="Number of days of history to return")):
    """
    Returns historical M2 Money Supply and YoY % growth with metadata.
    Frontend should poll this endpoint periodically and check metadata.is_stale.
    """
    try:
        return macro_service.get_liquidity(days=days, include_metadata=True)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (ConnectionError, Timeout, RequestException) as e:
        raise HTTPException(status_code=502, detail=f"Upstream Provider Error: {str(e)}")
    except Exception as e:
        logger.exception("Error fetching liquidity data")
        raise HTTPException(status_code=500, detail=f"Error fetching liquidity data: {str(e)}")

@router.get("/debt-status", response_model=schemas.DebtStatusResponse, responses=ERROR_RESPONSES)
def get_macro_debt_status(days: int = Query(None, description="Number of days of history to return")):
    """
    Returns the Interest-to-Tax ratio and individual components with metadata.
    Frontend should poll this endpoint periodically and check metadata.is_stale.
    """
    try:
        return macro_service.get_debt_status(days=days, include_metadata=True)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (ConnectionError, Timeout, RequestException) as e:
        raise HTTPException(status_code=502, detail=f"Upstream Provider Error: {str(e)}")
    except Exception as e:
        logger.exception("Error fetching debt status")
        raise HTTPException(status_code=500, detail=f"Error fetching debt status: {str(e)}")

@router.get("/real-rates", response_model=schemas.RealRatesResponse, responses=ERROR_RESPONSES)
def get_macro_real_rates():
    """
    Returns (10-Year Treasury Yield - CPI Inflation Rate) with metadata.
    Frontend should poll this endpoint periodically and check metadata.is_stale.
    """
    try:
        return macro_service.get_real_rates(include_metadata=True)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (ConnectionError, Timeout, RequestException) as e:
        raise HTTPException(status_code=502, detail=f"Upstream Provider Error: {str(e)}")
    except Exception as e:
        logger.exception("Error fetching real rates")
        raise HTTPException(status_code=500, detail=f"Error fetching real rates: {str(e)}")

@router.get("/cpi", response_model=schemas.CPIResponse, responses=ERROR_RESPONSES)
def get_macro_cpi():
    """
    Returns historical CPI data with metadata.
    Frontend should poll this endpoint periodically and check metadata.is_stale.
    """
    try:
        return macro_service.get_cpi_series(include_metadata=True)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (ConnectionError, Timeout, RequestException) as e:
        raise HTTPException(status_code=502, detail=f"Upstream Provider Error: {str(e)}")
    except Exception as e:
        logger.exception("Error fetching CPI data")
        raise HTTPException(status_code=500, detail=f"Error fetching CPI data: {str(e)}")
