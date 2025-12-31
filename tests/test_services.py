"""
Unit tests for backend/services.py

Tests the core data processing and calculation functions.
"""

import sys
from datetime import datetime
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest

# Mock yfinance before importing backend.services to avoid protobuf issues on Python 3.14
sys.modules['yfinance'] = MagicMock()

from backend.services import (
    add_technical_indicators,
    calculate_metrics,
    fetch_stock_data,
    process_data,
)


# --- Fixtures ---

@pytest.fixture
def sample_stock_data():
    """Create sample stock data DataFrame similar to yfinance output."""
    dates = pd.date_range(start="2024-01-01", periods=30, freq="D", tz="UTC")
    np.random.seed(42)
    base_price = 100.0
    prices = base_price + np.cumsum(np.random.randn(30) * 2)
    
    data = pd.DataFrame({
        "Open": prices - np.random.rand(30),
        "High": prices + np.random.rand(30) * 2,
        "Low": prices - np.random.rand(30) * 2,
        "Close": prices,
        "Volume": np.random.randint(1000000, 5000000, 30),
    }, index=dates)
    return data


@pytest.fixture
def processed_stock_data(sample_stock_data):
    """Sample data after process_data has been called."""
    return process_data(sample_stock_data.copy())


# --- Tests for process_data ---

class TestProcessData:
    """Tests for the process_data function."""

    def test_process_data_converts_timezone(self, sample_stock_data):
        """Test that process_data converts timezone to US/Eastern."""
        result = process_data(sample_stock_data.copy())
        # After processing, index should be reset and datetime column should exist
        # The column name can be 'Datetime', 'Date', or 'index' depending on pandas version
        datetime_col = None
        for col in ['Datetime', 'Date', 'index']:
            if col in result.columns:
                datetime_col = col
                break
        assert datetime_col is not None, "Expected a datetime column after processing"
        # Check the datetime column has the correct timezone
        assert str(result[datetime_col].dt.tz) == "US/Eastern"

    def test_process_data_resets_index(self, sample_stock_data):
        """Test that process_data resets the index."""
        result = process_data(sample_stock_data.copy())
        # Index should be a RangeIndex after reset
        assert isinstance(result.index, pd.RangeIndex)

    def test_process_data_renames_date_column(self, sample_stock_data):
        """Test that Date column is renamed to Datetime."""
        result = process_data(sample_stock_data.copy())
        # After reset_index and rename, we should have a Datetime column
        assert 'Datetime' in result.columns, "Expected a Datetime column after processing"

    def test_process_data_handles_naive_datetime(self):
        """Test process_data with timezone-naive data."""
        dates = pd.date_range(start="2024-01-01", periods=5, freq="D")
        data = pd.DataFrame({
            "Open": [100, 101, 102, 103, 104],
            "Close": [101, 102, 103, 104, 105],
            "High": [102, 103, 104, 105, 106],
            "Low": [99, 100, 101, 102, 103],
            "Volume": [1000, 1100, 1200, 1300, 1400],
        }, index=dates)
        
        result = process_data(data)
        # After processing, should have a datetime column with US/Eastern timezone
        datetime_col = None
        for col in ['Datetime', 'Date', 'index']:
            if col in result.columns:
                datetime_col = col
                break
        assert datetime_col is not None, "Expected a datetime column after processing"
        assert result[datetime_col].dt.tz is not None, "Datetime column should be timezone-aware"


# --- Tests for calculate_metrics ---

class TestCalculateMetrics:
    """Tests for the calculate_metrics function."""

    def test_calculate_metrics_returns_dict(self, processed_stock_data):
        """Test that calculate_metrics returns a dictionary."""
        result = calculate_metrics(processed_stock_data)
        assert isinstance(result, dict)

    def test_calculate_metrics_has_required_keys(self, processed_stock_data):
        """Test that the result contains all required keys."""
        result = calculate_metrics(processed_stock_data)
        required_keys = ["last_close", "change", "pct_change", "high", "low", "volume"]
        for key in required_keys:
            assert key in result, f"Missing key: {key}"

    def test_calculate_metrics_values_are_correct_types(self, processed_stock_data):
        """Test that metric values have correct types."""
        result = calculate_metrics(processed_stock_data)
        assert isinstance(result["last_close"], float)
        assert isinstance(result["change"], float)
        assert isinstance(result["pct_change"], float)
        assert isinstance(result["high"], float)
        assert isinstance(result["low"], float)
        assert isinstance(result["volume"], int)

    def test_calculate_metrics_change_calculation(self):
        """Test that change is calculated correctly."""
        data = pd.DataFrame({
            "Close": [100.0, 105.0, 110.0],
            "High": [101.0, 106.0, 111.0],
            "Low": [99.0, 104.0, 109.0],
            "Volume": [1000, 1100, 1200],
        })
        result = calculate_metrics(data)
        
        # Change should be last_close - first_close = 110 - 100 = 10
        assert result["change"] == pytest.approx(10.0)
        # Percent change = (10 / 100) * 100 = 10%
        assert result["pct_change"] == pytest.approx(10.0)

    def test_calculate_metrics_high_low(self):
        """Test that high/low are calculated correctly."""
        data = pd.DataFrame({
            "Close": [100.0, 105.0, 110.0],
            "High": [102.0, 115.0, 112.0],
            "Low": [98.0, 103.0, 108.0],
            "Volume": [1000, 1100, 1200],
        })
        result = calculate_metrics(data)
        
        assert result["high"] == pytest.approx(115.0)
        assert result["low"] == pytest.approx(98.0)

    def test_calculate_metrics_volume_sum(self):
        """Test that volume is summed correctly."""
        data = pd.DataFrame({
            "Close": [100.0, 105.0, 110.0],
            "High": [101.0, 106.0, 111.0],
            "Low": [99.0, 104.0, 109.0],
            "Volume": [1000, 2000, 3000],
        })
        result = calculate_metrics(data)
        
        assert result["volume"] == 6000


# --- Tests for add_technical_indicators ---

class TestAddTechnicalIndicators:
    """Tests for the add_technical_indicators function."""

    def test_add_technical_indicators_adds_sma(self, processed_stock_data):
        """Test that SMA_20 column is added."""
        result = add_technical_indicators(processed_stock_data.copy())
        assert "SMA_20" in result.columns

    def test_add_technical_indicators_adds_ema(self, processed_stock_data):
        """Test that EMA_20 column is added."""
        result = add_technical_indicators(processed_stock_data.copy())
        assert "EMA_20" in result.columns

    def test_add_technical_indicators_adds_rsi(self, processed_stock_data):
        """Test that RSI_14 column is added."""
        result = add_technical_indicators(processed_stock_data.copy())
        assert "RSI_14" in result.columns

    def test_add_technical_indicators_fills_nan_by_default(self, processed_stock_data):
        """Test that NaN values are filled with 0 by default (fill_na=True)."""
        result = add_technical_indicators(processed_stock_data.copy())
        # Should not have any NaN values
        assert not result["SMA_20"].isna().any()
        assert not result["EMA_20"].isna().any()
        assert not result["RSI_14"].isna().any()

    def test_add_technical_indicators_fill_na_false_preserves_nan(self, processed_stock_data):
        """Test that fill_na=False preserves NaN values for charting."""
        result = add_technical_indicators(processed_stock_data.copy(), fill_na=False)
        # SMA_20 should have NaN for first 19 rows (window=20)
        assert result["SMA_20"].isna().any(), "SMA_20 should have NaN values when fill_na=False"

    def test_add_technical_indicators_fill_na_true_replaces_nan(self, processed_stock_data):
        """Test that fill_na=True explicitly replaces NaN with 0."""
        result = add_technical_indicators(processed_stock_data.copy(), fill_na=True)
        # No NaN values when fill_na=True
        assert not result["SMA_20"].isna().any()
        assert not result["EMA_20"].isna().any()
        assert not result["RSI_14"].isna().any()

    def test_add_technical_indicators_preserves_original_columns(self, processed_stock_data):
        """Test that original columns are preserved."""
        original_columns = set(processed_stock_data.columns)
        result = add_technical_indicators(processed_stock_data.copy())
        
        for col in original_columns:
            assert col in result.columns


# --- Tests for fetch_stock_data ---

class TestFetchStockData:
    """Tests for the fetch_stock_data function."""

    @patch("backend.services.yf.download")
    def test_fetch_stock_data_calls_yfinance(self, mock_download):
        """Test that fetch_stock_data calls yfinance.download."""
        mock_download.return_value = pd.DataFrame({
            "Open": [100],
            "Close": [101],
            "High": [102],
            "Low": [99],
            "Volume": [1000],
        })
        
        fetch_stock_data("AAPL", "1d", "1m")
        mock_download.assert_called_once()

    @patch("backend.services.yf.download")
    def test_fetch_stock_data_raises_on_empty(self, mock_download):
        """Test that fetch_stock_data raises exception for empty data."""
        mock_download.return_value = pd.DataFrame()
        
        with pytest.raises(Exception, match="Error fetching data"):
            fetch_stock_data("INVALID", "1d", "1m")

    @patch("backend.services.yf.download")
    def test_fetch_stock_data_handles_max_period(self, mock_download):
        """Test that fetch_stock_data handles 'max' period."""
        mock_download.return_value = pd.DataFrame({
            "Open": [100],
            "Close": [101],
            "High": [102],
            "Low": [99],
            "Volume": [1000],
        })
        
        fetch_stock_data("AAPL", "max", "1d")
        mock_download.assert_called_with(
            "AAPL", period="max", interval="1d", auto_adjust=False
        )

    @patch("backend.services.yf.download")
    def test_fetch_stock_data_returns_dataframe(self, mock_download):
        """Test that fetch_stock_data returns a DataFrame."""
        expected_df = pd.DataFrame({
            "Open": [100, 101],
            "Close": [101, 102],
            "High": [102, 103],
            "Low": [99, 100],
            "Volume": [1000, 1100],
        })
        mock_download.return_value = expected_df
        
        result = fetch_stock_data("AAPL", "1d", "1m")
        assert isinstance(result, pd.DataFrame)
        assert len(result) == 2
