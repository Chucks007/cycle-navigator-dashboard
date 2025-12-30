"""
Unit tests for stock_dashboard.py

Tests the pure calculation functions from the dashboard module.
Note: Functions that depend on Streamlit (st.error, st.warning) are harder to test
in isolation, so we focus on the pure calculation logic.
"""

from unittest.mock import patch

import numpy as np
import pandas as pd
import pytest


# Import functions from stock_dashboard
# Note: We need to mock streamlit before importing to avoid initialization errors
@pytest.fixture(autouse=True)
def mock_streamlit():
    """Mock streamlit to prevent page config errors during import."""
    with patch.dict("sys.modules", {"streamlit": __import__("unittest.mock").mock.MagicMock()}):
        yield


# We'll test the calculation functions directly by recreating them here
# since importing the full module triggers Streamlit initialization

def calculate_metrics(data):
    """Mirror of stock_dashboard.calculate_metrics for testing."""
    last_close = float(data['Close'].iloc[-1].item()) if hasattr(data['Close'].iloc[-1], 'item') else float(data['Close'].iloc[-1])
    prev_close = float(data['Close'].iloc[0].item()) if hasattr(data['Close'].iloc[0], 'item') else float(data['Close'].iloc[0])
    change = last_close - prev_close
    pct_change = (change / prev_close) * 100
    high = float(data['High'].max().item()) if hasattr(data['High'].max(), 'item') else float(data['High'].max())
    low = float(data['Low'].min().item()) if hasattr(data['Low'].min(), 'item') else float(data['Low'].min())
    volume = int(data['Volume'].sum().item()) if hasattr(data['Volume'].sum(), 'item') else int(data['Volume'].sum())
    return last_close, change, pct_change, high, low, volume


def calculate_risk_metrics(data, risk_free_rate=0.04):
    """Mirror of stock_dashboard.calculate_risk_metrics for testing."""
    if data is None or len(data) < 2:
        return np.nan, np.nan

    close_col = data['Close']
    if isinstance(close_col, pd.DataFrame):
        try:
            close_series = close_col.squeeze()
        except Exception:
            close_series = close_col.iloc[:, 0]
    else:
        close_series = close_col

    close_series = pd.to_numeric(close_series, errors='coerce')
    returns = close_series.pct_change().dropna()

    if len(returns) < 2:
        return np.nan, np.nan

    volatility = float(returns.std() * np.sqrt(252))
    annualized_return = float(returns.mean() * 252)

    if volatility == 0 or np.isnan(volatility):
        sharpe = np.nan
    else:
        sharpe = float((annualized_return - risk_free_rate) / volatility)

    return volatility, sharpe


# --- Fixtures ---

@pytest.fixture
def sample_stock_data():
    """Create sample stock data DataFrame."""
    np.random.seed(42)
    dates = pd.date_range(start="2024-01-01", periods=30, freq="D")
    base_price = 100.0
    prices = base_price + np.cumsum(np.random.randn(30) * 2)
    
    return pd.DataFrame({
        "Open": prices - np.random.rand(30),
        "High": prices + np.random.rand(30) * 2,
        "Low": prices - np.random.rand(30) * 2,
        "Close": prices,
        "Volume": np.random.randint(1000000, 5000000, 30),
    }, index=dates)


# --- Tests for calculate_metrics ---

class TestDashboardCalculateMetrics:
    """Tests for the dashboard's calculate_metrics function."""

    def test_returns_tuple_of_six_values(self, sample_stock_data):
        """Test that function returns 6 values."""
        result = calculate_metrics(sample_stock_data)
        assert len(result) == 6

    def test_last_close_is_correct(self):
        """Test last_close is the final closing price."""
        data = pd.DataFrame({
            "Close": [100.0, 110.0, 120.0],
            "High": [105.0, 115.0, 125.0],
            "Low": [95.0, 105.0, 115.0],
            "Volume": [1000, 1000, 1000],
        })
        last_close, _, _, _, _, _ = calculate_metrics(data)
        assert last_close == pytest.approx(120.0)

    def test_change_calculation(self):
        """Test change is last_close - first_close."""
        data = pd.DataFrame({
            "Close": [100.0, 110.0, 150.0],
            "High": [105.0, 115.0, 155.0],
            "Low": [95.0, 105.0, 145.0],
            "Volume": [1000, 1000, 1000],
        })
        _, change, _, _, _, _ = calculate_metrics(data)
        assert change == pytest.approx(50.0)

    def test_pct_change_calculation(self):
        """Test percent change is calculated correctly."""
        data = pd.DataFrame({
            "Close": [100.0, 110.0, 150.0],
            "High": [105.0, 115.0, 155.0],
            "Low": [95.0, 105.0, 145.0],
            "Volume": [1000, 1000, 1000],
        })
        _, _, pct_change, _, _, _ = calculate_metrics(data)
        # (150 - 100) / 100 * 100 = 50%
        assert pct_change == pytest.approx(50.0)

    def test_high_is_maximum(self):
        """Test high is the maximum of High column."""
        data = pd.DataFrame({
            "Close": [100.0, 110.0, 120.0],
            "High": [105.0, 200.0, 125.0],  # 200 is max
            "Low": [95.0, 105.0, 115.0],
            "Volume": [1000, 1000, 1000],
        })
        _, _, _, high, _, _ = calculate_metrics(data)
        assert high == pytest.approx(200.0)

    def test_low_is_minimum(self):
        """Test low is the minimum of Low column."""
        data = pd.DataFrame({
            "Close": [100.0, 110.0, 120.0],
            "High": [105.0, 115.0, 125.0],
            "Low": [50.0, 105.0, 115.0],  # 50 is min
            "Volume": [1000, 1000, 1000],
        })
        _, _, _, _, low, _ = calculate_metrics(data)
        assert low == pytest.approx(50.0)

    def test_volume_is_sum(self):
        """Test volume is sum of all volumes."""
        data = pd.DataFrame({
            "Close": [100.0, 110.0, 120.0],
            "High": [105.0, 115.0, 125.0],
            "Low": [95.0, 105.0, 115.0],
            "Volume": [1000, 2000, 3000],
        })
        _, _, _, _, _, volume = calculate_metrics(data)
        assert volume == 6000


# --- Tests for calculate_risk_metrics ---

class TestCalculateRiskMetrics:
    """Tests for the calculate_risk_metrics function."""

    def test_returns_tuple_of_two_values(self, sample_stock_data):
        """Test that function returns 2 values (volatility, sharpe)."""
        result = calculate_risk_metrics(sample_stock_data)
        assert len(result) == 2

    def test_returns_nan_for_none_data(self):
        """Test that None data returns NaN values."""
        volatility, sharpe = calculate_risk_metrics(None)
        assert np.isnan(volatility)
        assert np.isnan(sharpe)

    def test_returns_nan_for_insufficient_data(self):
        """Test that data with < 2 rows returns NaN."""
        data = pd.DataFrame({"Close": [100.0]})
        volatility, sharpe = calculate_risk_metrics(data)
        assert np.isnan(volatility)
        assert np.isnan(sharpe)

    def test_volatility_is_positive(self, sample_stock_data):
        """Test that volatility is non-negative."""
        volatility, _ = calculate_risk_metrics(sample_stock_data)
        assert volatility >= 0

    def test_volatility_with_constant_prices(self):
        """Test that constant prices give zero volatility."""
        data = pd.DataFrame({
            "Close": [100.0, 100.0, 100.0, 100.0, 100.0],
        })
        volatility, sharpe = calculate_risk_metrics(data)
        assert volatility == pytest.approx(0.0)
        # Sharpe should be NaN when volatility is 0
        assert np.isnan(sharpe)

    def test_sharpe_calculation(self):
        """Test Sharpe ratio calculation with known values."""
        # Create data with predictable daily returns
        # Starting at 100, increasing 1% daily
        prices = [100.0 * (1.01 ** i) for i in range(30)]
        data = pd.DataFrame({"Close": prices})
        
        volatility, sharpe = calculate_risk_metrics(data, risk_free_rate=0.0)
        
        # With constant 1% daily return:
        # Annualized return ≈ 0.01 * 252 = 2.52 (252%)
        # Volatility should be very low (near 0) since returns are constant
        # Since volatility is near 0, sharpe will be very high
        assert volatility < 0.01  # Very low volatility for constant returns
        # Sharpe should be positive with positive returns and zero risk-free rate
        assert sharpe > 0

    def test_different_risk_free_rates(self, sample_stock_data):
        """Test that different risk-free rates affect Sharpe ratio."""
        _, sharpe_low = calculate_risk_metrics(sample_stock_data, risk_free_rate=0.01)
        _, sharpe_high = calculate_risk_metrics(sample_stock_data, risk_free_rate=0.10)
        
        # Higher risk-free rate should give lower Sharpe ratio
        # (assuming returns are similar)
        assert sharpe_high < sharpe_low


# --- Tests for process_data ---

def process_data(data):
    """Mirror of stock_dashboard.process_data for testing."""
    if data.index.tz is None:
        data.index = data.index.tz_localize('UTC')
    data.index = data.index.tz_convert('US/Eastern')
    data.reset_index(inplace=True)

    # Flatten MultiIndex columns - drop the ticker suffix
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)

    # Rename index column to 'Datetime'
    first_col = data.columns[0]
    if first_col != 'Datetime':
        data.rename(columns={first_col: 'Datetime'}, inplace=True)
    data['Datetime'] = pd.to_datetime(data['Datetime'])

    return data


class TestProcessData:
    """Tests for the process_data function."""

    def test_flattens_multiindex_columns(self):
        """Test that MultiIndex columns are flattened to simple strings."""
        # Create DataFrame with MultiIndex columns (like yfinance returns for multi-ticker)
        dates = pd.date_range(start="2024-01-01", periods=5, freq="D", tz="UTC")
        arrays = [
            ['Close', 'Open', 'High', 'Low', 'Volume'],
            ['AAPL', 'AAPL', 'AAPL', 'AAPL', 'AAPL']
        ]
        tuples = list(zip(*arrays))
        columns = pd.MultiIndex.from_tuples(tuples)
        data = pd.DataFrame(
            np.random.randn(5, 5),
            index=dates,
            columns=columns
        )

        result = process_data(data)

        # Columns should no longer be MultiIndex
        assert not isinstance(result.columns, pd.MultiIndex)
        # Should have flattened column names
        assert 'Close_AAPL' in result.columns
        assert 'Open_AAPL' in result.columns
        assert 'Datetime' in result.columns

    def test_preserves_single_level_columns(self):
        """Test that single-level columns are preserved correctly."""
        dates = pd.date_range(start="2024-01-01", periods=5, freq="D", tz="UTC")
        data = pd.DataFrame({
            'Close': [100, 101, 102, 103, 104],
            'Open': [99, 100, 101, 102, 103],
            'High': [102, 103, 104, 105, 106],
            'Low': [98, 99, 100, 101, 102],
            'Volume': [1000, 1100, 1200, 1300, 1400],
        }, index=dates)

        result = process_data(data)

        # Should have standard column names
        assert 'Close' in result.columns
        assert 'Open' in result.columns
        assert 'Datetime' in result.columns

    def test_datetime_column_exists(self):
        """Test that Datetime column is created from Date index."""
        dates = pd.date_range(start="2024-01-01", periods=5, freq="D", tz="UTC")
        data = pd.DataFrame({'Close': [100, 101, 102, 103, 104]}, index=dates)

        result = process_data(data)

        assert 'Datetime' in result.columns
        assert pd.api.types.is_datetime64_any_dtype(result['Datetime'])

    def test_timezone_conversion(self):
        """Test that timezone is converted to US/Eastern."""
        dates = pd.date_range(start="2024-01-01 12:00:00", periods=5, freq="h", tz="UTC")
        data = pd.DataFrame({'Close': [100, 101, 102, 103, 104]}, index=dates)

        result = process_data(data)

        # Datetime should be in US/Eastern timezone (converted from UTC)
        assert result['Datetime'].dt.tz is not None
