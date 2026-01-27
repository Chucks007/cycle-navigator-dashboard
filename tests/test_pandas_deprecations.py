"""
Test suite to ensure no pandas deprecation warnings are triggered.

This test file specifically checks for FutureWarnings and DeprecationWarnings
from pandas operations to prevent regressions.
"""

import warnings
import pytest
import pandas as pd
import numpy as np
from unittest.mock import MagicMock, patch

from backend.services.macro import MacroService
from backend.services.stock_service import StockService


class TestPandasDeprecations:
    """Test suite for pandas deprecation warnings."""

    def test_macro_service_pct_change_no_warnings(self):
        """Verify MacroService.get_liquidity() doesn't trigger pandas FutureWarning."""
        
        # Create mock data
        mock_m2_data = pd.Series(
            [100.0, 102.0, 105.0, 108.0, 110.0, 112.0, 115.0, 118.0, 120.0, 122.0, 125.0, 128.0, 130.0],
            index=pd.date_range('2023-01-01', periods=13, freq='ME')
        )
        
        service = MacroService()
        
        # Mock _get_series to return test data
        with patch.object(service, '_get_series', return_value=(mock_m2_data, {'last_updated': '2024-01-01T00:00:00Z', 'is_stale': False})):
            # Capture all warnings
            with warnings.catch_warnings(record=True) as w:
                warnings.simplefilter("always")
                
                # Call the method that uses pct_change
                result = service.get_liquidity(include_metadata=True)
                
                # Filter for pandas FutureWarnings about fill_method
                pandas_warnings = [
                    warning for warning in w
                    if issubclass(warning.category, FutureWarning)
                    and 'fill_method' in str(warning.message)
                ]
                
                # Assert no pandas fill_method warnings were raised
                assert len(pandas_warnings) == 0, (
                    f"Found {len(pandas_warnings)} pandas FutureWarning(s) about fill_method: "
                    f"{[str(w.message) for w in pandas_warnings]}"
                )
                
                # Verify we got valid data back
                assert 'data' in result
                assert len(result['data']) > 0

    def test_macro_service_real_rates_no_warnings(self):
        """Verify MacroService.get_real_rates() doesn't trigger pandas FutureWarning."""
        
        # Create mock data
        mock_gs10_data = pd.Series(
            [4.0, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 5.0, 5.1, 5.2],
            index=pd.date_range('2023-01-01', periods=13, freq='ME')
        )
        mock_cpi_data = pd.Series(
            [300.0, 301.0, 302.0, 303.0, 304.0, 305.0, 306.0, 307.0, 308.0, 309.0, 310.0, 311.0, 312.0],
            index=pd.date_range('2023-01-01', periods=13, freq='ME')
        )
        
        service = MacroService()
        
        def mock_get_series(series_id):
            if 'GS10' in series_id:
                return mock_gs10_data, {'last_updated': '2024-01-01T00:00:00Z', 'is_stale': False}
            else:
                return mock_cpi_data, {'last_updated': '2024-01-01T00:00:00Z', 'is_stale': False}
        
        # Mock _get_series to return test data
        with patch.object(service, '_get_series', side_effect=mock_get_series):
            # Capture all warnings
            with warnings.catch_warnings(record=True) as w:
                warnings.simplefilter("always")
                
                # Call the method that uses pct_change
                result = service.get_real_rates(include_metadata=True)
                
                # Filter for pandas FutureWarnings about fill_method
                pandas_warnings = [
                    warning for warning in w
                    if issubclass(warning.category, FutureWarning)
                    and 'fill_method' in str(warning.message)
                ]
                
                # Assert no pandas fill_method warnings were raised
                assert len(pandas_warnings) == 0, (
                    f"Found {len(pandas_warnings)} pandas FutureWarning(s) about fill_method: "
                    f"{[str(w.message) for w in pandas_warnings]}"
                )
                
                # Verify we got valid data back
                assert 'data' in result

    def test_stock_service_risk_metrics_no_warnings(self):
        """Verify StockService.calculate_risk_metrics() doesn't trigger pandas FutureWarning."""
        
        # Create mock stock price data
        dates = pd.date_range('2023-01-01', periods=30, freq='D')
        mock_data = pd.DataFrame({
            'Close': np.random.uniform(100, 150, 30)
        }, index=dates)
        
        service = StockService()
        
        # Capture all warnings
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            
            # Call the method that uses pct_change
            volatility, sharpe = service.calculate_risk_metrics(mock_data, risk_free_rate=0.04)
            
            # Filter for pandas FutureWarnings about fill_method
            pandas_warnings = [
                warning for warning in w
                if issubclass(warning.category, FutureWarning)
                and 'fill_method' in str(warning.message)
            ]
            
            # Assert no pandas fill_method warnings were raised
            assert len(pandas_warnings) == 0, (
                f"Found {len(pandas_warnings)} pandas FutureWarning(s) about fill_method: "
                f"{[str(w.message) for w in pandas_warnings]}"
            )
            
            # Verify we got valid results
            assert not np.isnan(volatility)
            assert not np.isnan(sharpe)

    def test_pct_change_behavior_unchanged(self):
        """Verify that explicit fill_method=None produces expected behavior."""
        
        # Test data with a gap (NaN)
        data = pd.Series([100.0, 110.0, np.nan, 130.0, 140.0])
        
        # Calculate with explicit fill_method=None
        result = data.pct_change(fill_method=None)
        
        # Expected behavior: NaN propagates
        assert pd.isna(result.iloc[0])  # First value is always NaN
        assert not pd.isna(result.iloc[1])  # 10% increase
        assert pd.isna(result.iloc[2])  # NaN input -> NaN output
        assert pd.isna(result.iloc[3])  # Previous value was NaN, so this is also NaN
        assert not pd.isna(result.iloc[4])  # Valid calculation from 130 to 140
        
        # Verify the actual percentage change values
        assert abs(result.iloc[1] - 0.1) < 0.001  # 10% increase
        assert abs(result.iloc[4] - (140.0/130.0 - 1)) < 0.001  # ~7.7% increase


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
