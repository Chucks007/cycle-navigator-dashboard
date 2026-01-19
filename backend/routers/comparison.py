from fastapi import APIRouter, HTTPException, Query
from typing import List
import logging
from requests.exceptions import ConnectionError, Timeout, RequestException

from .. import schemas
from ..comparison_service import fetch_normalized_comparison, calculate_hard_vs_soft_ratio, HARD_ASSETS, SOFT_ASSETS
from .utils import ERROR_RESPONSES

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/comparison",
    tags=["Comparison"]
)

@router.get("/barbell", response_model=List[schemas.ComparisonResult], responses=ERROR_RESPONSES)
def get_barbell_comparison(period: str = Query("1y", description="Time period (e.g. 1y, ytd)")):
    """
    Fetch normalized comparison data for Barbell Strategy (Hard vs Soft Assets).
    """
    try:
        # 1. Fetch asset lists
        hard_tickers = list(HARD_ASSETS.keys())
        soft_tickers = list(SOFT_ASSETS.keys())
        all_tickers = hard_tickers + soft_tickers

        # 2. Call service to get normalized data
        _, normalized_df = fetch_normalized_comparison(all_tickers, period=period)

        # 3. Calculate indices and ratio
        ratio_df = calculate_hard_vs_soft_ratio(normalized_df, hard_tickers, soft_tickers)

        # 4. Format for response
        ratio_df = ratio_df.reset_index()
        # Rename Date -> date
        ratio_df.rename(columns={'Date': 'date'}, inplace=True)
        # Ensure we have a string date
        if 'date' in ratio_df.columns:
            ratio_df['date'] = ratio_df['date'].dt.strftime('%Y-%m-%d')
        else:
            # Fallback if index name is different or missing
            # It should be the first column after reset_index if unnamed
            ratio_df['date'] = ratio_df.iloc[:, 0].dt.strftime('%Y-%m-%d')
            
        # Select and validate fields
        result = ratio_df[['date', 'Hard_Index', 'Soft_Index', 'Ratio', 'Ratio_Normalized']].to_dict(orient='records')
        return result

    except ValueError as e:
        logger.warning(f"Bad request barbell: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except (ConnectionError, Timeout, RequestException) as e:
        logger.error(f"Upstream error barbell: {e}")
        raise HTTPException(status_code=502, detail=f"Upstream Provider Error: {str(e)}")
    except Exception as e:
        logger.exception("Unexpected error in get_barbell_comparison")
        raise HTTPException(status_code=500, detail=str(e))
