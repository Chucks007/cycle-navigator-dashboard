"""
Logarithmic Regression Risk Service

Implements non-linear logarithmic regression logic to create "Fair Value" bands
for volatile assets (primarily BTC and ETH). This provides the mathematical basis
for the "Risk Metric" (0-1) used throughout the dashboard.

Mathematical Formula: y = 10^(a * ln(x) + b)
"""

import hashlib
import logging
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from scipy.optimize import curve_fit

import backend.services as services

from . import common as common_utils

logger = logging.getLogger(__name__)

# Asset inception dates (first trading day on major exchanges)
ASSET_INCEPTION_DATES: dict[str, str] = {
    "BTC-USD": "2010-07-18",  # Mt. Gox
    "ETH-USD": "2015-08-07",  # First major exchange
    "BTC": "2010-07-18",
    "ETH": "2015-08-07",
}

# Band configuration - from bottom to top
BAND_CONFIG = [
    {"level": 0, "name": "Fire Sale", "std_multiplier": -3.0, "color": "#7c3aed"},       # Violet
    {"level": 1, "name": "Deep Value", "std_multiplier": -2.0, "color": "#8b5cf6"},     # Purple
    {"level": 2, "name": "Undervalued", "std_multiplier": -1.0, "color": "#3b82f6"},    # Blue
    {"level": 3, "name": "Below Fair", "std_multiplier": -0.5, "color": "#06b6d4"},     # Cyan
    {"level": 4, "name": "Fair Value", "std_multiplier": 0.0, "color": "#22c55e"},      # Green (center)
    {"level": 5, "name": "Above Fair", "std_multiplier": 0.5, "color": "#eab308"},      # Yellow
    {"level": 6, "name": "Overvalued", "std_multiplier": 1.0, "color": "#f97316"},      # Orange
    {"level": 7, "name": "Bubble Zone", "std_multiplier": 2.0, "color": "#ef4444"},     # Red
    {"level": 8, "name": "Maximum Bubble", "std_multiplier": 3.0, "color": "#dc2626"},  # Dark Red
]

# Cache for regression parameters (they don't change significantly day-to-day)
_regression_cache: dict[str, tuple[dict, datetime]] = {}
CACHE_TTL_HOURS = 24


def _log_regression_model(x: np.ndarray, a: float, b: float) -> np.ndarray:
    """
    Logarithmic regression model: y = 10^(a * ln(x) + b)

    This power law model captures the diminishing growth rate of crypto assets
    over time while accounting for their exponential price appreciation.

    Args:
        x: Days since inception (must be > 0)
        a: Slope coefficient (growth rate decay)
        b: Intercept (initial value offset)

    Returns:
        Predicted price values
    """
    # Protect against log(0) by ensuring x >= 1
    x_safe = np.maximum(x, 1)
    return np.power(10, a * np.log(x_safe) + b)


def _get_cache_key(ticker: str, data_hash: str) -> str:
    """Generate a cache key based on ticker and data hash."""
    return f"{ticker}:{data_hash}"


def _compute_data_hash(dates: list[str], prices: list[float]) -> str:
    """Compute a hash of the data for cache invalidation."""
    data_str = f"{dates[-1]}:{len(dates)}:{prices[-1]:.2f}"
    return hashlib.md5(data_str.encode()).hexdigest()[:8]


def _get_inception_date(ticker: str) -> datetime:
    """Get the inception date for a given ticker."""
    ticker_upper = ticker.upper()

    # Check exact match first
    if ticker_upper in ASSET_INCEPTION_DATES:
        return datetime.strptime(ASSET_INCEPTION_DATES[ticker_upper], "%Y-%m-%d")

    # Check with -USD suffix
    if f"{ticker_upper}-USD" in ASSET_INCEPTION_DATES:
        return datetime.strptime(ASSET_INCEPTION_DATES[f"{ticker_upper}-USD"], "%Y-%m-%d")

    # Default fallback: use first data point
    return None


def _make_naive(dt: datetime) -> datetime:
    """Convert a datetime to timezone-naive (UTC)."""
    if dt.tzinfo is not None:
        # Convert to UTC then strip timezone
        return dt.replace(tzinfo=None)
    return dt


def fetch_historical_data(ticker: str, period: str = "max") -> pd.DataFrame:
    """
    Fetch historical price data for regression analysis.

    Args:
        ticker: Asset ticker (e.g., "BTC-USD", "ETH-USD")
        period: Time period to fetch ("max" for all available data)

    Returns:
        DataFrame with Date index and Close prices
    """
    yf = services.get_yf()
    error = services.get_yf_import_error()

    if error is not None:
        raise Exception(f"yfinance not available: {error}")

    # Normalize ticker format
    ticker_normalized = ticker.upper()
    if not ticker_normalized.endswith("-USD") and ticker_normalized in ["BTC", "ETH"]:
        ticker_normalized = f"{ticker_normalized}-USD"

    try:
        data = yf.download(
            ticker_normalized,
            period=period,
            interval="1d",
            auto_adjust=True,
            progress=False
        )

        if data.empty:
            raise ValueError(f"No historical data found for {ticker}")

        # Standardize the dataframe
        data = common_utils.standardize_dataframe(data, reset_index=True)

        return data

    except Exception as e:
        logger.error(f"Failed to fetch historical data for {ticker}: {e}")
        raise


def fit_regression(
    dates: list[datetime],
    prices: list[float],
    inception_date: datetime | None = None
) -> tuple[float, float, float]:
    """
    Fit logarithmic regression to historical price data.

    Args:
        dates: List of dates
        prices: List of corresponding prices
        inception_date: Optional inception date for x-axis calculation

    Returns:
        Tuple of (a, b, residual_std) where a and b are regression coefficients
        and residual_std is the standard deviation of residuals in log space
    """
    if len(dates) < 30:
        raise ValueError("Insufficient data for regression (need at least 30 data points)")

    # Convert dates to "days since inception"
    if inception_date is None:
        inception_date = dates[0]

    x = np.array([(d - inception_date).days for d in dates], dtype=np.float64)

    # Filter out any x <= 0 (dates before inception)
    valid_mask = x > 0
    x = x[valid_mask]
    y = np.array(prices, dtype=np.float64)[valid_mask]

    # Filter out NaN and invalid prices
    valid_mask = (y > 0) & np.isfinite(y)
    x = x[valid_mask]
    y = y[valid_mask]

    if len(x) < 30:
        raise ValueError("Insufficient valid data points after filtering")

    # Transform to log space for fitting
    log_y = np.log10(y)
    np.log(x)

    # Initial guess for parameters
    # a: typical values for BTC are around 2-4
    # b: depends on scale, typically -5 to 0
    p0 = [3.0, -5.0]

    try:
        # Fit the model using curve_fit
        popt, pcov = curve_fit(
            lambda x_fit, a, b: a * np.log(x_fit) + b,
            x, log_y,
            p0=p0,
            maxfev=10000,
            bounds=([0.1, -20], [10, 10])  # Reasonable bounds
        )

        a, b = popt

        # Calculate residuals in log space
        predicted_log = a * np.log(x) + b
        residuals = log_y - predicted_log
        residual_std = np.std(residuals)

        logger.info(f"Regression fit: a={a:.4f}, b={b:.4f}, std={residual_std:.4f}")

        return float(a), float(b), float(residual_std)

    except Exception as e:
        logger.error(f"Curve fitting failed: {e}")
        raise ValueError(f"Failed to fit regression model: {e}")


def generate_bands(
    dates: list[datetime],
    a: float,
    b: float,
    residual_std: float,
    inception_date: datetime | None = None
) -> list[dict]:
    """
    Generate regression bands from fitted parameters.

    Args:
        dates: List of dates for which to generate bands
        a: Regression slope coefficient
        b: Regression intercept
        residual_std: Standard deviation of residuals
        inception_date: Inception date for x calculation

    Returns:
        List of band dictionaries with values for each date
    """
    if inception_date is None:
        inception_date = dates[0]

    bands = []

    for band_config in BAND_CONFIG:
        std_mult = band_config["std_multiplier"]

        # Calculate band values for each date
        values = []
        for date in dates:
            days = (date - inception_date).days
            if days <= 0:
                values.append(None)
                continue

            # Base regression value: 10^(a*ln(x) + b)
            # Band value: shift in log space by std_multiplier * residual_std
            log_value = a * np.log(days) + b + (std_mult * residual_std)
            value = np.power(10, log_value)
            values.append(float(value))

        bands.append({
            "level": band_config["level"],
            "name": band_config["name"],
            "color": band_config["color"],
            "std_multiplier": std_mult,
            "values": [
                {"date": date.strftime("%Y-%m-%d"), "value": val}
                for date, val in zip(dates, values, strict=False)
                if val is not None
            ]
        })

    return bands


def calculate_risk_score(
    current_price: float,
    current_date: datetime,
    a: float,
    b: float,
    residual_std: float,
    inception_date: datetime
) -> float:
    """
    Calculate the risk score (0.0 - 1.0) based on current price position.

    0.0 = Maximally undervalued (at or below -3 std)
    0.5 = Fair value (on regression line)
    1.0 = Maximally overvalued (at or above +3 std)

    Args:
        current_price: Current asset price
        current_date: Current date
        a, b: Regression coefficients
        residual_std: Standard deviation of residuals
        inception_date: Asset inception date

    Returns:
        Risk score between 0.0 and 1.0
    """
    days = (current_date - inception_date).days
    if days <= 0:
        return 0.5  # Cannot calculate, return neutral

    # Calculate fair value
    log_fair = a * np.log(days) + b
    np.power(10, log_fair)

    # Calculate current position in standard deviations from fair value
    if current_price <= 0:
        return 0.0

    log_current = np.log10(current_price)
    log_deviation = (log_current - log_fair) / residual_std

    # Normalize to 0-1 scale
    # -3 std -> 0.0, 0 std -> 0.5, +3 std -> 1.0
    risk_score = (log_deviation + 3.0) / 6.0

    # Clamp to [0, 1]
    return float(max(0.0, min(1.0, risk_score)))


def get_current_band(risk_score: float) -> dict:
    """
    Determine which band the current risk score falls into.

    Args:
        risk_score: Risk score between 0.0 and 1.0

    Returns:
        Band configuration dictionary
    """
    # Convert risk score back to std multiplier
    std_mult = (risk_score * 6.0) - 3.0

    # Find the closest band
    closest_band = BAND_CONFIG[4]  # Default to fair value
    min_diff = float('inf')

    for band in BAND_CONFIG:
        diff = abs(band["std_multiplier"] - std_mult)
        if diff < min_diff:
            min_diff = diff
            closest_band = band

    return closest_band


def get_risk_data(ticker: str, use_cache: bool = True) -> dict:
    """
    Main function to get complete risk data for an asset.

    Args:
        ticker: Asset ticker (e.g., "BTC", "ETH", "BTC-USD")
        use_cache: Whether to use cached regression parameters

    Returns:
        Dictionary containing:
        - ticker: Asset ticker
        - current_risk: Risk score (0.0 - 1.0)
        - current_band: Current band information
        - current_price: Latest price
        - fair_value: Current fair value estimate
        - bands: List of band data with historical values
        - regression_params: Fitted a, b, and std values
        - inception_date: Asset inception date used
    """
    # Normalize ticker
    ticker_upper = ticker.upper()
    ticker_with_suffix = ticker_upper if ticker_upper.endswith("-USD") else f"{ticker_upper}-USD"

    # Fetch historical data
    data = fetch_historical_data(ticker_with_suffix)

    # Parse dates and prices
    dates = pd.to_datetime(data['date']).tolist()
    # Convert to naive datetime (strip timezone info for consistent calculations)
    dates = [_make_naive(d.to_pydatetime()) for d in dates]

    # Handle potential column name variations
    price_col = 'Close' if 'Close' in data.columns else 'close'
    prices = data[price_col].tolist()

    # Filter NaN values
    valid_data = [(d, p) for d, p in zip(dates, prices, strict=False) if pd.notna(p) and p > 0]
    if not valid_data:
        raise ValueError(f"No valid price data for {ticker}")

    dates, prices = zip(*valid_data, strict=False)
    dates = list(dates)
    prices = list(prices)

    # Get inception date (already naive)
    inception_date = _get_inception_date(ticker_upper)
    if inception_date is None:
        inception_date = dates[0]

    # Check cache
    data_hash = _compute_data_hash(
        [d.strftime("%Y-%m-%d") for d in dates],
        prices
    )
    cache_key = _get_cache_key(ticker_upper, data_hash)

    cached = _regression_cache.get(cache_key)
    if use_cache and cached:
        params, cached_time = cached
        if datetime.now() - cached_time < timedelta(hours=CACHE_TTL_HOURS):
            a, b, residual_std = params['a'], params['b'], params['std']
            logger.info(f"Using cached regression params for {ticker}")
        else:
            # Cache expired
            a, b, residual_std = fit_regression(dates, prices, inception_date)
            _regression_cache[cache_key] = (
                {'a': a, 'b': b, 'std': residual_std},
                datetime.now()
            )
    else:
        # Fit new regression
        a, b, residual_std = fit_regression(dates, prices, inception_date)
        _regression_cache[cache_key] = (
            {'a': a, 'b': b, 'std': residual_std},
            datetime.now()
        )

    # Generate bands
    bands = generate_bands(dates, a, b, residual_std, inception_date)

    # Calculate current values
    current_date = dates[-1]
    current_price = prices[-1]

    risk_score = calculate_risk_score(
        current_price, current_date,
        a, b, residual_std,
        inception_date
    )

    current_band = get_current_band(risk_score)

    # Calculate fair value
    days = (current_date - inception_date).days
    fair_value = np.power(10, a * np.log(days) + b) if days > 0 else current_price

    return {
        "ticker": ticker_upper,
        "current_risk": round(risk_score, 4),
        "current_band": {
            "level": current_band["level"],
            "name": current_band["name"],
            "color": current_band["color"]
        },
        "current_price": round(current_price, 2),
        "fair_value": round(float(fair_value), 2),
        "bands": bands,
        "regression_params": {
            "a": round(a, 6),
            "b": round(b, 6),
            "std": round(residual_std, 6)
        },
        "inception_date": inception_date.strftime("%Y-%m-%d"),
        "data_points": len(dates)
    }


def get_risk_score_only(ticker: str) -> dict:
    """
    Get just the risk score without full band data (faster for dashboard cards).

    Args:
        ticker: Asset ticker

    Returns:
        Dictionary with ticker, current_risk, current_band, current_price, fair_value
    """
    full_data = get_risk_data(ticker)

    return {
        "ticker": full_data["ticker"],
        "current_risk": full_data["current_risk"],
        "current_band": full_data["current_band"],
        "current_price": full_data["current_price"],
        "fair_value": full_data["fair_value"]
    }
