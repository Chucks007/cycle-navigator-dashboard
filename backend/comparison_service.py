"""
Comparison Service for the Barbell Strategy module.

This module provides functionality to fetch and normalize multiple asset classes
for comparative analysis, supporting the "Hard Assets vs Paper Assets" thesis.
"""


import numpy as np
import pandas as pd

from .utils import get_yf, get_yf_import_error

# Asset class definitions
HARD_ASSETS = {
    "GLD": "Gold",
    "SLV": "Silver",
    "BTC-USD": "Bitcoin"
}

SOFT_ASSETS = {
    "SPY": "S&P 500",
    "TLT": "Long-Term Treasuries"
}

# All default comparison assets
DEFAULT_COMPARISON_ASSETS = list(HARD_ASSETS.keys()) + list(SOFT_ASSETS.keys())

# Period mapping to yfinance period strings
COMPARISON_PERIODS = {
    "YTD": "ytd",
    "1Y": "1y",
    "3Y": "3y",
    "5Y": "5y",
    "10Y": "10y"
}


def fetch_comparison_data(tickers: list[str], period: str = "1y") -> pd.DataFrame:
    """
    Fetch historical close prices for multiple tickers.

    Args:
        tickers: List of ticker symbols to fetch
        period: Time period (ytd, 1y, 3y, 5y, 10y)

    Returns:
        DataFrame with Date index and ticker columns containing Close prices
    """
    # Validate input early to provide clear errors regardless of optional
    # dependency availability (helps tests and CI where yfinance may fail to import).
    if not tickers:
        raise ValueError("No tickers provided")

    yf = get_yf()
    error = get_yf_import_error()

    if error is not None:
        raise Exception(f"yfinance not available: {error}")

    try:
        # Download all tickers at once for efficiency
        data = yf.download(
            tickers,
            period=period,
            interval="1d",
            auto_adjust=True,
            progress=False,
            group_by='ticker'
        )

        if data.empty:
            raise ValueError("No data returned for the specified tickers")

        # Extract Close prices
        if len(tickers) == 1:
            # Single ticker: data has simple columns
            close_df = pd.DataFrame(data['Close'])
            close_df.columns = tickers
        else:
            # Multiple tickers: data is multi-indexed
            close_df = pd.DataFrame()
            for ticker in tickers:
                if ticker in data.columns.levels[0]:
                    close_df[ticker] = data[ticker]['Close']

        # Drop rows where all values are NaN
        close_df = close_df.dropna(how='all')

        return close_df

    except Exception as e:
        raise Exception(f"Error fetching comparison data: {e}")


def normalize_to_base_100(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalize all columns to start at 100.

    Formula: Normalized_Price_t = (Price_t / Price_start) * 100

    Args:
        df: DataFrame with price data

    Returns:
        DataFrame with normalized values (all starting at 100)
    """
    if df.empty:
        return df

    # Forward fill any missing values to handle different trading days
    df = df.ffill()

    # Get the first valid value for each column
    first_valid = df.bfill().iloc[0]

    # Normalize to base 100
    normalized = (df / first_valid) * 100

    return normalized


def fetch_normalized_comparison(
    tickers: list[str],
    period: str = "1y"
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Fetch and normalize price data for multiple assets.

    Args:
        tickers: List of ticker symbols
        period: Time period string (ytd, 1y, 3y, 5y, 10y)

    Returns:
        Tuple of (raw_prices_df, normalized_df)
    """
    raw_data = fetch_comparison_data(tickers, period)
    normalized_data = normalize_to_base_100(raw_data)

    return raw_data, normalized_data


def calculate_hard_vs_soft_ratio(
    normalized_df: pd.DataFrame,
    hard_assets: list[str] = None,
    soft_assets: list[str] = None
) -> pd.DataFrame:
    """
    Calculate the Hard Assets vs Soft Assets ratio.

    Hard_Index = Average of normalized hard asset prices
    Soft_Index = Average of normalized soft asset prices
    Ratio = Hard_Index / Soft_Index

    Rising ratio = Hard assets outperforming
    Falling ratio = Soft assets outperforming

    Args:
        normalized_df: DataFrame with normalized prices (base 100)
        hard_assets: List of hard asset tickers (defaults to GLD, SLV, BTC-USD)
        soft_assets: List of soft asset tickers (defaults to SPY, TLT)

    Returns:
        DataFrame with Hard_Index, Soft_Index, and Ratio columns
    """
    if hard_assets is None:
        hard_assets = list(HARD_ASSETS.keys())
    if soft_assets is None:
        soft_assets = list(SOFT_ASSETS.keys())

    # Filter to available assets
    available_hard = [a for a in hard_assets if a in normalized_df.columns]
    available_soft = [a for a in soft_assets if a in normalized_df.columns]

    if not available_hard or not available_soft:
        raise ValueError("Need at least one hard asset and one soft asset for ratio calculation")

    result = pd.DataFrame(index=normalized_df.index)

    # Calculate equal-weighted indices
    result['Hard_Index'] = normalized_df[available_hard].mean(axis=1)
    result['Soft_Index'] = normalized_df[available_soft].mean(axis=1)

    # Calculate ratio (avoid division by zero)
    result['Ratio'] = result['Hard_Index'] / result['Soft_Index'].replace(0, np.nan)

    # Also normalize the ratio to start at 100 for easier interpretation
    first_valid_ratio = result['Ratio'].bfill().iloc[0]
    result['Ratio_Normalized'] = (result['Ratio'] / first_valid_ratio) * 100

    return result


def get_performance_summary(normalized_df: pd.DataFrame) -> dict[str, dict]:
    """
    Calculate performance summary for each asset.

    Args:
        normalized_df: DataFrame with normalized prices

    Returns:
        Dictionary with ticker -> {current_value, pct_gain, asset_type}
    """
    summary = {}

    for ticker in normalized_df.columns:
        series = normalized_df[ticker].dropna()
        if len(series) < 2:
            continue

        current_value = series.iloc[-1]
        pct_gain = current_value - 100  # Since we normalized to 100

        # Determine asset type
        if ticker in HARD_ASSETS:
            asset_type = "Hard Asset"
            asset_name = HARD_ASSETS[ticker]
        elif ticker in SOFT_ASSETS:
            asset_type = "Paper Asset"
            asset_name = SOFT_ASSETS[ticker]
        else:
            asset_type = "Other"
            asset_name = ticker

        summary[ticker] = {
            "name": asset_name,
            "current_value": round(current_value, 2),
            "pct_gain": round(pct_gain, 2),
            "asset_type": asset_type
        }

    return summary


def get_asset_info() -> dict[str, dict]:
    """
    Return information about available assets for the UI.

    Returns:
        Dictionary with asset type -> {ticker: name} mappings
    """
    return {
        "hard_assets": HARD_ASSETS,
        "soft_assets": SOFT_ASSETS,
        "periods": COMPARISON_PERIODS
    }


def get_barbell_comparison(period: str = "1y") -> list[dict]:
    """
    Orchestrator function for the Barbell Strategy comparison.

    Fetches data, calculates ratios, and formats the response in one go.

    Args:
        period: Time period string (ytd, 1y, 3y, 5y, 10y)

    Returns:
        List of dictionaries with date, Hard_Index, Soft_Index, Ratio, Ratio_Normalized
    """
    from .services.common import format_for_api

    # 1. Fetch asset lists
    hard_tickers = list(HARD_ASSETS.keys())
    soft_tickers = list(SOFT_ASSETS.keys())
    all_tickers = hard_tickers + soft_tickers

    # 2. Call service to get normalized data
    _, normalized_df = fetch_normalized_comparison(all_tickers, period=period)

    # 3. Calculate indices and ratio
    ratio_df = calculate_hard_vs_soft_ratio(normalized_df, hard_tickers, soft_tickers)

    # 4. Format for response using the standardized helper
    ratio_df = ratio_df.reset_index()
    # Rename Date -> date for consistency
    ratio_df.rename(columns={'Date': 'date'}, inplace=True)

    # Select required fields
    result_df = ratio_df[['date', 'Hard_Index', 'Soft_Index', 'Ratio', 'Ratio_Normalized']]

    # Use standardized formatting
    return format_for_api(result_df, date_format='%Y-%m-%d')
