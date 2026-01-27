"""
Unit tests for MacroService.get_dashboard_summary method.
Tests the new service method that aggregates macro data and calculates summary metrics.
"""
import unittest
from unittest.mock import MagicMock, patch
from datetime import datetime

from backend.services.macro import MacroService
from backend import schemas


class TestMacroDashboardSummary(unittest.TestCase):
    """Test suite for get_dashboard_summary method"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.service = MacroService()
        
    def test_get_dashboard_summary_with_valid_data(self):
        """Test dashboard summary with valid data from all series"""
        # Mock individual service methods with sample data
        mock_liquidity = {
            'data': [
                schemas.LiquidityPoint(date='2023-01-01', value=100.0, growth_rate=0.05),
                schemas.LiquidityPoint(date='2023-02-01', value=105.0, growth_rate=0.06),
            ],
            'metadata': {'last_updated': '2023-02-01T00:00:00', 'is_stale': False}
        }
        
        mock_debt = {
            'data': [
                schemas.DebtPoint(date='2023-01-01', interest_payments=50.0, tax_receipts=100.0, ratio=50.0),
                schemas.DebtPoint(date='2023-02-01', interest_payments=55.0, tax_receipts=110.0, ratio=50.0),
            ],
            'metadata': {'last_updated': '2023-02-01T00:00:00', 'is_stale': False}
        }
        
        mock_real_rates = {
            'data': [
                schemas.RealRatePoint(date='2023-01-01', treasury_yield_10y=0.04, cpi_inflation=0.03, real_rate=0.01),
                schemas.RealRatePoint(date='2023-02-01', treasury_yield_10y=0.045, cpi_inflation=0.035, real_rate=0.01),
            ],
            'metadata': {'last_updated': '2023-02-01T00:00:00', 'is_stale': False}
        }
        
        mock_cpi = {
            'data': [
                schemas.CPIPoint(date='2023-01-01', value=300.0),
                schemas.CPIPoint(date='2023-02-01', value=305.0),
            ],
            'metadata': {'last_updated': '2023-02-01T00:00:00', 'is_stale': False}
        }
        
        # Mock the individual service methods
        self.service.get_liquidity = MagicMock(return_value=mock_liquidity)
        self.service.get_debt_status = MagicMock(return_value=mock_debt)
        self.service.get_real_rates = MagicMock(return_value=mock_real_rates)
        self.service.get_cpi_series = MagicMock(return_value=mock_cpi)
        
        # Call the method under test
        result = self.service.get_dashboard_summary(days=30)
        
        # Verify structure
        self.assertIn('liquidity', result)
        self.assertIn('debt_status', result)
        self.assertIn('real_rates', result)
        self.assertIn('cpi', result)
        self.assertIn('summary', result)
        
        # Verify summary metrics extracted from latest values
        summary = result['summary']
        self.assertIsInstance(summary, schemas.MacroMetrics)
        self.assertEqual(summary.m2_supply, 105.0)
        self.assertEqual(summary.m2_growth, 0.06)
        self.assertEqual(summary.debt_to_tax_ratio, 50.0)
        self.assertEqual(summary.real_rate, 0.01)
        
        # Verify service methods were called with correct parameters
        self.service.get_liquidity.assert_called_once_with(days=30, include_metadata=True)
        self.service.get_debt_status.assert_called_once_with(days=30, include_metadata=True)
        self.service.get_real_rates.assert_called_once_with(include_metadata=True)
        self.service.get_cpi_series.assert_called_once_with(include_metadata=True)
    
    def test_get_dashboard_summary_with_empty_data(self):
        """Test dashboard summary when all series return empty data"""
        empty_response = {
            'data': [],
            'metadata': {'last_updated': None, 'is_stale': True}
        }
        
        self.service.get_liquidity = MagicMock(return_value=empty_response)
        self.service.get_debt_status = MagicMock(return_value=empty_response)
        self.service.get_real_rates = MagicMock(return_value=empty_response)
        self.service.get_cpi_series = MagicMock(return_value=empty_response)
        
        result = self.service.get_dashboard_summary()
        
        # Verify structure exists even with empty data
        self.assertIn('summary', result)
        summary = result['summary']
        
        # All values should default to 0.0
        self.assertEqual(summary.m2_supply, 0.0)
        self.assertEqual(summary.m2_growth, 0.0)
        self.assertEqual(summary.debt_to_tax_ratio, 0.0)
        self.assertEqual(summary.real_rate, 0.0)
    
    def test_get_dashboard_summary_with_missing_growth_rate(self):
        """Test dashboard summary when growth_rate attribute is missing"""
        mock_liquidity = {
            'data': [
                schemas.LiquidityPoint(date='2023-01-01', value=100.0, growth_rate=None),
            ],
            'metadata': {'last_updated': '2023-01-01T00:00:00', 'is_stale': False}
        }
        
        mock_debt = {
            'data': [schemas.DebtPoint(date='2023-01-01', interest_payments=50.0, tax_receipts=100.0, ratio=50.0)],
            'metadata': {'last_updated': '2023-01-01T00:00:00', 'is_stale': False}
        }
        
        mock_real_rates = {
            'data': [schemas.RealRatePoint(date='2023-01-01', treasury_yield_10y=0.04, cpi_inflation=0.03, real_rate=0.01)],
            'metadata': {'last_updated': '2023-01-01T00:00:00', 'is_stale': False}
        }
        
        mock_cpi = {
            'data': [schemas.CPIPoint(date='2023-01-01', value=300.0)],
            'metadata': {'last_updated': '2023-01-01T00:00:00', 'is_stale': False}
        }
        
        self.service.get_liquidity = MagicMock(return_value=mock_liquidity)
        self.service.get_debt_status = MagicMock(return_value=mock_debt)
        self.service.get_real_rates = MagicMock(return_value=mock_real_rates)
        self.service.get_cpi_series = MagicMock(return_value=mock_cpi)
        
        result = self.service.get_dashboard_summary()
        
        # Should handle None growth_rate gracefully
        summary = result['summary']
        self.assertEqual(summary.m2_supply, 100.0)
        self.assertEqual(summary.m2_growth, 0.0)  # Defaults to 0.0 when None
    
    def test_get_dashboard_summary_without_days_filter(self):
        """Test dashboard summary without days filter (returns all data)"""
        mock_liquidity = {
            'data': [schemas.LiquidityPoint(date='2023-01-01', value=100.0, growth_rate=0.05)],
            'metadata': {'last_updated': '2023-01-01T00:00:00', 'is_stale': False}
        }
        
        mock_debt = {
            'data': [schemas.DebtPoint(date='2023-01-01', interest_payments=50.0, tax_receipts=100.0, ratio=50.0)],
            'metadata': {'last_updated': '2023-01-01T00:00:00', 'is_stale': False}
        }
        
        mock_real_rates = {
            'data': [schemas.RealRatePoint(date='2023-01-01', treasury_yield_10y=0.04, cpi_inflation=0.03, real_rate=0.01)],
            'metadata': {'last_updated': '2023-01-01T00:00:00', 'is_stale': False}
        }
        
        mock_cpi = {
            'data': [schemas.CPIPoint(date='2023-01-01', value=300.0)],
            'metadata': {'last_updated': '2023-01-01T00:00:00', 'is_stale': False}
        }
        
        self.service.get_liquidity = MagicMock(return_value=mock_liquidity)
        self.service.get_debt_status = MagicMock(return_value=mock_debt)
        self.service.get_real_rates = MagicMock(return_value=mock_real_rates)
        self.service.get_cpi_series = MagicMock(return_value=mock_cpi)
        
        result = self.service.get_dashboard_summary()
        
        # Verify None is passed for days parameter
        self.service.get_liquidity.assert_called_once_with(days=None, include_metadata=True)
        self.service.get_debt_status.assert_called_once_with(days=None, include_metadata=True)


if __name__ == '__main__':
    unittest.main()
