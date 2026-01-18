"""
Tests for the Risk Service (Logarithmic Regression Bands).
"""

import pytest
from datetime import datetime, timedelta
import numpy as np
from unittest.mock import patch, MagicMock

# Test fixtures and helpers
@pytest.fixture
def sample_dates():
    """Generate sample dates spanning several years."""
    start = datetime(2015, 1, 1)
    return [start + timedelta(days=i) for i in range(365 * 5)]  # 5 years


@pytest.fixture
def sample_prices(sample_dates):
    """Generate sample prices following a power law with noise."""
    # Simulate BTC-like growth: y = 10^(a*ln(x) + b) with noise
    a, b = 2.5, -4.0  # Typical BTC parameters
    prices = []
    
    for i, date in enumerate(sample_dates):
        x = i + 1  # Days since start (avoid log(0))
        base_price = np.power(10, a * np.log(x) + b)
        # Add some noise (±30%)
        noise = np.random.uniform(0.7, 1.3)
        prices.append(base_price * noise)
    
    return prices


class TestLogRegressionModel:
    """Test the core logarithmic regression model."""
    
    def test_model_positive_output(self):
        """Model should always produce positive values."""
        from backend.services.risk import _log_regression_model
        
        x = np.array([1, 10, 100, 1000, 10000])
        a, b = 2.5, -4.0
        
        result = _log_regression_model(x, a, b)
        
        assert all(r > 0 for r in result)
    
    def test_model_increasing_trend(self):
        """Model should show increasing trend for positive slope."""
        from backend.services.risk import _log_regression_model
        
        x = np.array([1, 10, 100, 1000])
        a, b = 2.5, -4.0
        
        result = _log_regression_model(x, a, b)
        
        # Each value should be greater than the previous
        for i in range(1, len(result)):
            assert result[i] > result[i-1]
    
    def test_model_handles_zero(self):
        """Model should handle zero values safely."""
        from backend.services.risk import _log_regression_model
        
        x = np.array([0, 1, 10])
        a, b = 2.5, -4.0
        
        # Should not raise, zeros are clamped to 1
        result = _log_regression_model(x, a, b)
        assert len(result) == 3


class TestFitRegression:
    """Test the curve fitting logic."""
    
    def test_fit_requires_minimum_data(self, sample_dates, sample_prices):
        """Fitting should require at least 30 data points."""
        from backend.services.risk import fit_regression
        
        with pytest.raises(ValueError, match="Insufficient data"):
            fit_regression(sample_dates[:20], sample_prices[:20])
    
    def test_fit_returns_valid_parameters(self, sample_dates, sample_prices):
        """Fitting should return reasonable a, b, and std values."""
        from backend.services.risk import fit_regression
        
        a, b, std = fit_regression(sample_dates, sample_prices)
        
        # a should be positive (growth)
        assert a > 0
        # Standard deviation should be positive
        assert std > 0
    
    def test_fit_handles_nan_values(self, sample_dates):
        """Fitting should handle NaN values gracefully."""
        from backend.services.risk import fit_regression
        
        # Create prices with some NaN values
        prices = [100.0 * (1.01 ** i) for i in range(len(sample_dates))]
        prices[50] = float('nan')
        prices[100] = float('nan')
        
        # Should not raise
        a, b, std = fit_regression(sample_dates, prices)
        
        assert np.isfinite(a)
        assert np.isfinite(b)
        assert np.isfinite(std)


class TestRiskScore:
    """Test the risk score calculation."""
    
    def test_risk_score_bounds(self):
        """Risk score should always be between 0 and 1."""
        from backend.services.risk import calculate_risk_score
        
        inception = datetime(2010, 7, 18)
        current_date = datetime(2024, 1, 1)
        a, b, std = 2.5, -4.0, 0.3
        
        # Test various price levels
        prices = [100, 1000, 10000, 100000, 1000000]
        
        for price in prices:
            score = calculate_risk_score(price, current_date, a, b, std, inception)
            assert 0.0 <= score <= 1.0
    
    def test_risk_score_fair_value(self):
        """Price at fair value should give ~0.5 risk score."""
        from backend.services.risk import calculate_risk_score
        
        inception = datetime(2010, 7, 18)
        current_date = datetime(2024, 1, 1)
        a, b, std = 2.5, -4.0, 0.3
        
        # Calculate fair value
        days = (current_date - inception).days
        fair_value = np.power(10, a * np.log(days) + b)
        
        score = calculate_risk_score(fair_value, current_date, a, b, std, inception)
        
        # Should be very close to 0.5
        assert 0.45 <= score <= 0.55
    
    def test_risk_score_monotonic(self):
        """Higher prices should give higher risk scores."""
        from backend.services.risk import calculate_risk_score
        
        inception = datetime(2010, 7, 18)
        current_date = datetime(2024, 1, 1)
        a, b, std = 2.5, -4.0, 0.3
        
        prices = [1000, 10000, 50000, 100000]
        scores = [
            calculate_risk_score(p, current_date, a, b, std, inception)
            for p in prices
        ]
        
        # Each score should be >= the previous
        for i in range(1, len(scores)):
            assert scores[i] >= scores[i-1]


class TestGenerateBands:
    """Test band generation logic."""
    
    def test_generates_correct_number_of_bands(self, sample_dates):
        """Should generate 9 bands by default."""
        from backend.services.risk import generate_bands
        
        a, b, std = 2.5, -4.0, 0.3
        
        bands = generate_bands(sample_dates[:100], a, b, std)
        
        assert len(bands) == 9
    
    def test_bands_have_required_fields(self, sample_dates):
        """Each band should have level, name, color, and values."""
        from backend.services.risk import generate_bands
        
        a, b, std = 2.5, -4.0, 0.3
        
        bands = generate_bands(sample_dates[:100], a, b, std)
        
        for band in bands:
            assert "level" in band
            assert "name" in band
            assert "color" in band
            assert "values" in band
            assert len(band["values"]) > 0
    
    def test_bands_ordered_by_level(self, sample_dates):
        """Bands should be ordered from level 0 (bottom) to level 8 (top)."""
        from backend.services.risk import generate_bands
        
        a, b, std = 2.5, -4.0, 0.3
        
        bands = generate_bands(sample_dates[:100], a, b, std)
        
        levels = [b["level"] for b in bands]
        assert levels == sorted(levels)


class TestGetCurrentBand:
    """Test band lookup from risk score."""
    
    def test_low_risk_returns_bottom_bands(self):
        """Low risk scores should return bottom bands."""
        from backend.services.risk import get_current_band
        
        band = get_current_band(0.1)
        assert band["level"] <= 2
        
    def test_high_risk_returns_top_bands(self):
        """High risk scores should return top bands."""
        from backend.services.risk import get_current_band
        
        band = get_current_band(0.9)
        assert band["level"] >= 6
    
    def test_mid_risk_returns_fair_value(self):
        """Risk score of 0.5 should return fair value band."""
        from backend.services.risk import get_current_band
        
        band = get_current_band(0.5)
        assert band["name"] == "Fair Value"


class TestCaching:
    """Test regression parameter caching."""
    
    def test_cache_key_generation(self):
        """Cache keys should be deterministic."""
        from backend.services.risk import _get_cache_key, _compute_data_hash
        
        dates = ["2024-01-01", "2024-01-02", "2024-01-03"]
        prices = [100.0, 101.0, 102.0]
        
        hash1 = _compute_data_hash(dates, prices)
        hash2 = _compute_data_hash(dates, prices)
        
        assert hash1 == hash2
        
        key1 = _get_cache_key("BTC", hash1)
        key2 = _get_cache_key("BTC", hash2)
        
        assert key1 == key2
    
    def test_cache_key_changes_with_data(self):
        """Cache key should change when data changes."""
        from backend.services.risk import _compute_data_hash
        
        dates1 = ["2024-01-01", "2024-01-02"]
        prices1 = [100.0, 101.0]
        
        dates2 = ["2024-01-01", "2024-01-02", "2024-01-03"]
        prices2 = [100.0, 101.0, 102.0]
        
        hash1 = _compute_data_hash(dates1, prices1)
        hash2 = _compute_data_hash(dates2, prices2)
        
        assert hash1 != hash2


class TestInceptionDates:
    """Test inception date handling."""
    
    def test_btc_inception_date(self):
        """BTC should have correct inception date."""
        from backend.services.risk import _get_inception_date
        
        date = _get_inception_date("BTC")
        assert date == datetime(2010, 7, 18)
        
        date = _get_inception_date("BTC-USD")
        assert date == datetime(2010, 7, 18)
    
    def test_eth_inception_date(self):
        """ETH should have correct inception date."""
        from backend.services.risk import _get_inception_date
        
        date = _get_inception_date("ETH")
        assert date == datetime(2015, 8, 7)
    
    def test_unknown_ticker_returns_none(self):
        """Unknown tickers should return None."""
        from backend.services.risk import _get_inception_date
        
        date = _get_inception_date("UNKNOWN")
        assert date is None
