"""
Tests for the Comparison Service (Barbell Strategy).
"""

import pytest
import pandas as pd
import numpy as np
from unittest.mock import patch, MagicMock

from backend.services.comparison import (
    normalize_to_base_100,
    calculate_hard_vs_soft_ratio,
    get_performance_summary,
    get_asset_info,
    fetch_comparison_data,
    fetch_normalized_comparison,
    HARD_ASSETS,
    SOFT_ASSETS,
)


class TestNormalization:
    """Test cases for price normalization functions."""
    
    def test_normalize_to_base_100_simple(self):
        """Test basic normalization to base 100."""
        # Create simple test data
        data = pd.DataFrame({
            'A': [100.0, 110.0, 120.0, 115.0],
            'B': [50.0, 55.0, 60.0, 52.5]
        })
        
        result = normalize_to_base_100(data)
        
        # First values should be 100
        assert result['A'].iloc[0] == pytest.approx(100.0)
        assert result['B'].iloc[0] == pytest.approx(100.0)
        
        # Check proportional increases
        assert result['A'].iloc[1] == pytest.approx(110.0)  # 10% increase
        assert result['B'].iloc[1] == pytest.approx(110.0)  # 10% increase
        
    def test_normalize_to_base_100_with_nan(self):
        """Test normalization handles NaN values via forward fill."""
        data = pd.DataFrame({
            'A': [100.0, np.nan, 120.0, 130.0],
            'B': [50.0, 55.0, np.nan, 60.0]
        })
        
        result = normalize_to_base_100(data)
        
        # Should have forward-filled NaN values
        assert not result.isna().any().any()
        
    def test_normalize_empty_dataframe(self):
        """Test normalization of empty dataframe."""
        data = pd.DataFrame()
        result = normalize_to_base_100(data)
        assert result.empty


class TestHardVsSoftRatio:
    """Test cases for Hard vs Soft ratio calculation."""
    
    def test_calculate_ratio_basic(self):
        """Test basic ratio calculation."""
        # Create normalized test data
        dates = pd.date_range('2024-01-01', periods=5)
        data = pd.DataFrame({
            'GLD': [100, 110, 120, 115, 125],  # Hard asset
            'SLV': [100, 105, 110, 108, 112],  # Hard asset
            'SPY': [100, 102, 104, 103, 106],  # Soft asset
            'TLT': [100, 101, 102, 100, 103],  # Soft asset
        }, index=dates)
        
        result = calculate_hard_vs_soft_ratio(data)
        
        assert 'Hard_Index' in result.columns
        assert 'Soft_Index' in result.columns
        assert 'Ratio' in result.columns
        assert 'Ratio_Normalized' in result.columns
        
        # First ratio should be normalized to 100
        assert result['Ratio_Normalized'].iloc[0] == 100.0
        
    def test_calculate_ratio_missing_assets(self):
        """Test ratio calculation with missing assets raises error."""
        data = pd.DataFrame({
            'GLD': [100, 110, 120],  # Only hard asset
        })
        
        with pytest.raises(ValueError, match="Need at least one hard asset"):
            calculate_hard_vs_soft_ratio(data)
            
    def test_calculate_ratio_custom_assets(self):
        """Test ratio calculation with custom asset lists."""
        dates = pd.date_range('2024-01-01', periods=3)
        data = pd.DataFrame({
            'GOLD': [100, 110, 120],
            'STOCKS': [100, 105, 110],
        }, index=dates)
        
        result = calculate_hard_vs_soft_ratio(
            data,
            hard_assets=['GOLD'],
            soft_assets=['STOCKS']
        )
        
        # Ratio should be GOLD / STOCKS
        expected_ratio_day2 = 110 / 105
        actual_ratio_day2 = result['Ratio'].iloc[1]
        assert abs(actual_ratio_day2 - expected_ratio_day2) < 0.001


class TestPerformanceSummary:
    """Test cases for performance summary generation."""
    
    def test_get_performance_summary(self):
        """Test performance summary calculation."""
        dates = pd.date_range('2024-01-01', periods=5)
        data = pd.DataFrame({
            'GLD': [100, 110, 120, 115, 125],  # +25% gain
            'SPY': [100, 102, 104, 103, 95],   # -5% loss
        }, index=dates)
        
        summary = get_performance_summary(data)
        
        assert 'GLD' in summary
        assert 'SPY' in summary
        
        assert summary['GLD']['pct_gain'] == 25.0
        assert summary['GLD']['asset_type'] == 'Hard Asset'
        
        assert summary['SPY']['pct_gain'] == -5.0
        assert summary['SPY']['asset_type'] == 'Paper Asset'


class TestAssetInfo:
    """Test cases for asset info retrieval."""
    
    def test_get_asset_info(self):
        """Test asset info structure."""
        info = get_asset_info()
        
        assert 'hard_assets' in info
        assert 'soft_assets' in info
        assert 'periods' in info
        
        assert 'GLD' in info['hard_assets']
        assert 'SPY' in info['soft_assets']


class TestFetchComparisonData:
    """Test cases for data fetching (with mocking)."""
    
    @patch('backend.services.comparison.get_yf')
    @patch('backend.services.comparison.get_yf_import_error')
    def test_fetch_comparison_data_success(self, mock_error, mock_yf):
        """Test successful data fetch."""
        mock_error.return_value = None
        
        # Create mock yfinance module
        mock_yf_instance = MagicMock()
        mock_yf.return_value = mock_yf_instance
        
        # Create mock download result
        dates = pd.date_range('2024-01-01', periods=5)
        mock_data = pd.DataFrame({
            ('SPY', 'Close'): [400, 405, 410, 408, 415],
            ('GLD', 'Close'): [180, 182, 185, 183, 188],
        }, index=dates)
        mock_data.columns = pd.MultiIndex.from_tuples(mock_data.columns)
        mock_yf_instance.download.return_value = mock_data
        
        result = fetch_comparison_data(['SPY', 'GLD'], '1y')
        
        assert 'SPY' in result.columns
        assert 'GLD' in result.columns
        assert len(result) == 5
        
    @patch('backend.services.comparison.get_yf_import_error')
    def test_fetch_comparison_data_no_yfinance(self, mock_error):
        """Test error when yfinance not available."""
        mock_error.return_value = "yfinance not installed"
        
        with pytest.raises(Exception, match="yfinance not available"):
            fetch_comparison_data(['SPY'], '1y')
            
    def test_fetch_comparison_data_empty_tickers(self):
        """Test error when no tickers provided."""
        with pytest.raises(ValueError, match="No tickers provided"):
            fetch_comparison_data([], '1y')


class TestConstants:
    """Test constants are properly defined."""
    
    def test_hard_assets_defined(self):
        """Test hard assets constant."""
        assert 'GLD' in HARD_ASSETS
        assert 'SLV' in HARD_ASSETS
        assert 'BTC-USD' in HARD_ASSETS
        
    def test_soft_assets_defined(self):
        """Test soft assets constant."""
        assert 'SPY' in SOFT_ASSETS
        assert 'TLT' in SOFT_ASSETS
