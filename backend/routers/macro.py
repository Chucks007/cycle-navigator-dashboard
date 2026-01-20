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
