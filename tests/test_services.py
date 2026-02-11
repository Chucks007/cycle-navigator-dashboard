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

from backend import config
from backend.services.stock_service import stock_service

# Extract methods from stock_service for test compatibility
add_technical_indicators = stock_service.add_technical_indicators
calculate_metrics = stock_service.calculate_metrics
calculate_risk_metrics = stock_service.calculate_risk_metrics
fetch_stock_data = stock_service.fetch_stock_data
process_data = stock_service.process_data

from backend.services.sentiment import (
    analyze_sentiment,
    get_sentiment_label,
    fetch_news_sentiment,
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


# --- Tests for calculate_risk_metrics ---

class TestCalculateRiskMetrics:
    """Tests for the calculate_risk_metrics function."""

    def test_calculate_risk_metrics_returns_tuple(self, processed_stock_data):
        """Test that calculate_risk_metrics returns a tuple of two floats."""
        volatility, sharpe = calculate_risk_metrics(processed_stock_data)
        assert isinstance(volatility, float)
        assert isinstance(sharpe, float)

    def test_calculate_risk_metrics_returns_nan_for_short_data(self):
        """Test that it returns (nan, nan) for insufficient data."""
        data = pd.DataFrame({"Close": [100.0]})
        volatility, sharpe = calculate_risk_metrics(data)
        assert np.isnan(volatility)
        assert np.isnan(sharpe)

    def test_calculate_risk_metrics_calculation(self):
        """Test calculation with known values."""
        # Create a series with constant return to make calculation easy
        # Price: 100, 110, 121 (10% return each day)
        data = pd.DataFrame({"Close": [100.0, 110.0, 121.0]})
        
        # Returns: 0.1, 0.1
        # Std dev of [0.1, 0.1] is 0.0
        # Volatility = 0.0 * sqrt(252) = 0.0
        
        volatility, sharpe = calculate_risk_metrics(data, risk_free_rate=0.0)
        
        assert volatility == 0.0
        assert np.isnan(sharpe) # Division by zero volatility -> nan

    def test_calculate_risk_metrics_positive_volatility(self):
        """Test calculation with varying returns."""
        # Price: 100, 110, 100 (Returns: +0.1, -0.0909...)
        data = pd.DataFrame({"Close": [100.0, 110.0, 100.0]})
        
        volatility, sharpe = calculate_risk_metrics(data, risk_free_rate=0.0)
        
        assert volatility > 0
        # Mean return is approx 0.0045
        # Sharpe should be calculated
        assert not np.isnan(sharpe)


# --- Tests for calculate_metrics ---

class TestCalculateMetrics:
    """Tests for the calculate_metrics function."""

    def test_calculate_metrics_returns_dict(self, processed_stock_data):
        """Test that calculate_metrics returns a StockMetrics object."""
        result = calculate_metrics(processed_stock_data, risk_free_rate=0.04)
        assert hasattr(result, "last_close")

    def test_calculate_metrics_has_required_keys(self, processed_stock_data):
        """Test that the result contains all required keys."""
        result = calculate_metrics(processed_stock_data, risk_free_rate=0.04)
        required_keys = [
            "last_close", "change", "pct_change", "high", "low", "volume",
            "volatility", "sharpe_ratio", "risk_free_rate"
        ]
        for key in required_keys:
            assert hasattr(result, key), f"Missing key: {key}"

    def test_calculate_metrics_values_are_correct_types(self, processed_stock_data):
        """Test that metric values have correct types."""
        result = calculate_metrics(processed_stock_data, risk_free_rate=0.04)
        assert isinstance(result.last_close, float)
        assert isinstance(result.change, float)
        assert isinstance(result.pct_change, float)
        assert isinstance(result.high, float)
        assert isinstance(result.low, float)
        assert isinstance(result.volume, int)
        # Volatility and Sharpe can be float or nan (which is float)
        assert isinstance(result.volatility, float)
        assert isinstance(result.sharpe_ratio, float)
        assert isinstance(result.risk_free_rate, float)

    def test_calculate_metrics_change_calculation(self):
        """Test that change is calculated correctly."""
        data = pd.DataFrame({
            "Close": [100.0, 105.0, 110.0],
            "High": [101.0, 106.0, 111.0],
            "Low": [99.0, 104.0, 109.0],
            "Volume": [1000, 1100, 1200],
        })
        result = calculate_metrics(data, risk_free_rate=0.04)
        
        # Change should be last_close - first_close = 110 - 100 = 10
        assert result.change == pytest.approx(10.0)
        # Percent change = (10 / 100) * 100 = 10%
        assert result.pct_change == pytest.approx(10.0)

    def test_calculate_metrics_high_low(self):
        """Test that high/low are calculated correctly."""
        data = pd.DataFrame({
            "Close": [100.0, 105.0, 110.0],
            "High": [102.0, 115.0, 112.0],
            "Low": [98.0, 103.0, 108.0],
            "Volume": [1000, 1100, 1200],
        })
        result = calculate_metrics(data, risk_free_rate=0.04)
        
        assert result.high == pytest.approx(115.0)
        assert result.low == pytest.approx(98.0)

    def test_calculate_metrics_volume_sum(self):
        """Test that volume is summed correctly."""
        data = pd.DataFrame({
            "Close": [100.0, 105.0, 110.0],
            "High": [101.0, 106.0, 111.0],
            "Low": [99.0, 104.0, 109.0],
            "Volume": [1000, 2000, 3000],
        })
        result = calculate_metrics(data, risk_free_rate=0.04)
        
        assert result.volume == 6000


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

    @patch("backend.services.get_yf_import_error", return_value=None)
    @patch("backend.services.common.yf.download")
    def test_fetch_stock_data_calls_yfinance(self, mock_download, mock_error):
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

    @patch("backend.services.get_yf_import_error", return_value=None)
    @patch("backend.services.common.yf.download")
    def test_fetch_stock_data_raises_on_empty(self, mock_download, mock_error):
        """Test that fetch_stock_data raises exception for empty data."""
        mock_download.return_value = pd.DataFrame()
        
        with pytest.raises(ValueError, match="No data found"):
            fetch_stock_data("INVALID", "1d", "1m")

    @patch("backend.services.get_yf_import_error", return_value=None)
    @patch("backend.services.common.yf.download")
    def test_fetch_stock_data_handles_max_period(self, mock_download, mock_error):
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
            "AAPL", period="max", interval="1d", auto_adjust=False, progress=False
        )
    @patch("backend.services.get_yf_import_error", return_value=None)
    @patch("backend.services.common.yf.download")
    def test_fetch_stock_data_returns_dataframe(self, mock_download, mock_error):
        """Test that fetch_stock_data returns a DataFrame."""
        dates = pd.date_range(start="2024-01-01", periods=2, freq="D", tz="UTC")
        expected_df = pd.DataFrame({
            "Open": [100, 101],
            "Close": [101, 102],
            "High": [102, 103],
            "Low": [99, 100],
            "Volume": [1000, 1100],
        }, index=dates)
        mock_download.return_value = expected_df
        
        result = fetch_stock_data("AAPL", "1d", "1m")
        assert isinstance(result, pd.DataFrame)
        # After standardization, the dataframe should still contain the data
        # but might have different index type (DatetimeIndex)
        assert len(result) >= 1


# --- Tests for Sentiment Analysis ---

class TestAnalyzeSentiment:
    """Tests for the analyze_sentiment function."""

    def test_analyze_sentiment_positive(self):
        """Test that positive text returns positive sentiment."""
        result = analyze_sentiment("This is amazing and wonderful news!")
        assert result > 0

    def test_analyze_sentiment_negative(self):
        """Test that negative text returns negative sentiment."""
        result = analyze_sentiment("This is terrible and horrible news.")
        assert result < 0

    def test_analyze_sentiment_neutral(self):
        """Test that neutral text returns near-zero sentiment."""
        result = analyze_sentiment("The company released quarterly earnings.")
        assert -0.5 <= result <= 0.5

    def test_analyze_sentiment_returns_float(self):
        """Test that analyze_sentiment returns a float."""
        result = analyze_sentiment("Test headline")
        assert isinstance(result, float)

    def test_analyze_sentiment_range(self):
        """Test that sentiment score is within valid range."""
        result = analyze_sentiment("Any text here")
        assert -1.0 <= result <= 1.0


class TestGetSentimentLabel:
    """Tests for the get_sentiment_label function."""

    def test_get_sentiment_label_bullish(self):
        """Test that positive score returns Bullish."""
        assert get_sentiment_label(0.5) == "Bullish"
        assert get_sentiment_label(0.11) == "Bullish"
        assert get_sentiment_label(1.0) == "Bullish"

    def test_get_sentiment_label_bearish(self):
        """Test that negative score returns Bearish."""
        assert get_sentiment_label(-0.5) == "Bearish"
        assert get_sentiment_label(-0.11) == "Bearish"
        assert get_sentiment_label(-1.0) == "Bearish"

    def test_get_sentiment_label_neutral(self):
        """Test that scores near zero return Neutral."""
        assert get_sentiment_label(0.0) == "Neutral"
        assert get_sentiment_label(0.1) == "Neutral"
        assert get_sentiment_label(-0.1) == "Neutral"
        assert get_sentiment_label(0.05) == "Neutral"


class TestFetchNewsSentiment:
    """Tests for the fetch_news_sentiment function."""

    @patch("backend.services.get_yf_import_error", return_value=None)
    @patch("backend.services.common.yf.Ticker")
    def test_fetch_news_sentiment_with_news(self, mock_ticker, mock_error):
        """Test fetch_news_sentiment with mock news data."""
        mock_ticker_instance = MagicMock()
        mock_ticker_instance.news = [
            {"title": "Great news for the company!", "link": "http://example.com/1", "publisher": "Test"},
            {"title": "Stock prices soar to new heights", "link": "http://example.com/2", "publisher": "News"},
        ]
        mock_ticker.return_value = mock_ticker_instance

        result = fetch_news_sentiment("AAPL")

        assert hasattr(result, "sentiment_score")
        assert hasattr(result, "sentiment_label")
        assert hasattr(result, "news_count")
        assert hasattr(result, "headlines")
        assert result.news_count == 2
        assert len(result.headlines) == 2

    @patch("backend.services.get_yf_import_error", return_value=None)
    @patch("backend.services.common.yf.Ticker")
    def test_fetch_news_sentiment_no_news(self, mock_ticker, mock_error):
        """Test fetch_news_sentiment when no news is available."""
        mock_ticker_instance = MagicMock()
        mock_ticker_instance.news = []
        mock_ticker.return_value = mock_ticker_instance

        result = fetch_news_sentiment("UNKNOWN")

        assert result.sentiment_score == 0.0
        assert result.sentiment_label == "Neutral"
        assert result.news_count == 0
        assert result.headlines == []
        assert result.message is not None

    @patch("backend.services.get_yf_import_error", return_value=None)
    @patch("backend.services.common.yf.Ticker")
    def test_fetch_news_sentiment_handles_exception(self, mock_ticker, mock_error):
        """Test fetch_news_sentiment handles exceptions gracefully."""
        mock_ticker.side_effect = Exception("API Error")

        result = fetch_news_sentiment("AAPL")

        assert result.sentiment_score == 0.0
        assert result.sentiment_label == "Neutral"
        assert result.message is not None

    @patch("backend.services.get_yf_import_error", return_value=None)
    @patch("backend.services.common.yf.Ticker")
    def test_fetch_news_sentiment_limits_headlines(self, mock_ticker, mock_error):
        """Test that fetch_news_sentiment limits to 10 headlines."""
        mock_ticker_instance = MagicMock()
        mock_ticker_instance.news = [
            {"title": f"Headline {i}", "link": f"http://example.com/{i}", "publisher": "Test"}
            for i in range(15)
        ]
        mock_ticker.return_value = mock_ticker_instance

        result = fetch_news_sentiment("AAPL")

        assert result.news_count == 10
        assert len(result.headlines) == 10


# --- Tests for Stock Fundamentals ---

class TestFetchFundamentals:
    """Tests for the fetch_fundamentals method."""

    @patch("backend.services.get_yf_import_error", return_value=None)
    @patch("backend.services.get_yf")
    def test_fetch_fundamentals_with_valid_data(self, mock_yf, mock_error):
        """Test fetch_fundamentals with valid stock data."""
        mock_ticker = MagicMock()
        mock_ticker.info = {
            'shortName': 'Apple Inc.',
            'marketCap': 3000000000000,
            'trailingPE': 28.5,
            'forwardPE': 25.2,
            'beta': 1.2,
            'fiftyTwoWeekHigh': 199.62,
            'fiftyTwoWeekLow': 164.08,
            'dividendYield': 0.0045,
            'trailingEps': 6.42,
            'profitMargins': 0.265,
            'priceToSalesTrailing12Months': 7.8,
            'debtToEquity': 170.73,
            'sector': 'Technology',
            'industry': 'Consumer Electronics',
            'regularMarketPrice': 185.0,
        }
        mock_yf.return_value.Ticker.return_value = mock_ticker

        result = stock_service.fetch_fundamentals("AAPL")

        assert result.ticker == "AAPL"
        assert result.name == "Apple Inc."
        assert result.market_cap == 3000000000000
        assert result.trailing_pe == 28.5
        assert result.beta == 1.2

    @patch("backend.services.get_yf_import_error", return_value=None)
    @patch("backend.services.get_yf")
    def test_fetch_fundamentals_with_missing_data(self, mock_yf, mock_error):
        """Test fetch_fundamentals handles missing fields gracefully."""
        mock_ticker = MagicMock()
        mock_ticker.info = {
            'shortName': 'Test Corp',
            'regularMarketPrice': 50.0,
            # Missing most fields
        }
        mock_yf.return_value.Ticker.return_value = mock_ticker

        result = stock_service.fetch_fundamentals("TEST")

        assert result.ticker == "TEST"
        assert result.name == "Test Corp"
        assert result.market_cap is None
        assert result.trailing_pe is None
        assert result.beta is None

    @patch("backend.services.get_yf_import_error", return_value=None)
    @patch("backend.services.get_yf")
    def test_fetch_fundamentals_with_crypto_ticker(self, mock_yf, mock_error):
        """Test fetch_fundamentals with crypto ticker (limited fundamentals)."""
        mock_ticker = MagicMock()
        mock_ticker.info = {
            'shortName': 'Bitcoin USD',
            'regularMarketPrice': 43000.0,
            # Crypto tickers typically have no P/E, dividends, etc.
        }
        mock_yf.return_value.Ticker.return_value = mock_ticker

        result = stock_service.fetch_fundamentals("BTC-USD")

        assert result.ticker == "BTC-USD"
        assert result.name == "Bitcoin USD"
        assert result.trailing_pe is None
        assert result.dividend_yield is None

