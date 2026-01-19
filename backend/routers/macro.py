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

@router.get("/liquidity", response_model=List[schemas.LiquidityPoint], responses=ERROR_RESPONSES)
def get_macro_liquidity(days: int = Query(None, description="Number of days of history to return")):
    """
    Returns historical M2 Money Supply and YoY % growth.
    """
    try:
        return macro_service.get_liquidity(days=days)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (ConnectionError, Timeout, RequestException) as e:
        raise HTTPException(status_code=502, detail=f"Upstream Provider Error: {str(e)}")
    except Exception as e:
        logger.exception("Error fetching liquidity data")
        raise HTTPException(status_code=500, detail=f"Error fetching liquidity data: {str(e)}")

@router.get("/debt-status", response_model=List[schemas.DebtPoint], responses=ERROR_RESPONSES)
def get_macro_debt_status(days: int = Query(None, description="Number of days of history to return")):
    """
    Returns the Interest-to-Tax ratio and individual components.
    """
    try:
        return macro_service.get_debt_status(days=days)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (ConnectionError, Timeout, RequestException) as e:
        raise HTTPException(status_code=502, detail=f"Upstream Provider Error: {str(e)}")
    except Exception as e:
        logger.exception("Error fetching debt status")
        raise HTTPException(status_code=500, detail=f"Error fetching debt status: {str(e)}")

@router.get("/real-rates", response_model=List[schemas.RealRatePoint], responses=ERROR_RESPONSES)
def get_macro_real_rates():
    """
    Returns (10-Year Treasury Yield - CPI Inflation Rate).
    """
    try:
        return macro_service.get_real_rates()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (ConnectionError, Timeout, RequestException) as e:
        raise HTTPException(status_code=502, detail=f"Upstream Provider Error: {str(e)}")
    except Exception as e:
        logger.exception("Error fetching real rates")
        raise HTTPException(status_code=500, detail=f"Error fetching real rates: {str(e)}")

@router.get("/cpi", response_model=List[schemas.CPIPoint], responses=ERROR_RESPONSES)
def get_macro_cpi():
    """
    Returns historical CPI data.
    """
    try:
        return macro_service.get_cpi_series()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (ConnectionError, Timeout, RequestException) as e:
        raise HTTPException(status_code=502, detail=f"Upstream Provider Error: {str(e)}")
    except Exception as e:
        logger.exception("Error fetching CPI data")
        raise HTTPException(status_code=500, detail=f"Error fetching CPI data: {str(e)}")
