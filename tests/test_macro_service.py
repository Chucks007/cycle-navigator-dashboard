import unittest
from unittest.mock import MagicMock, patch
import pandas as pd
import numpy as np
from datetime import datetime
from backend.services.macro import MacroService

class TestMacroService(unittest.TestCase):
    def setUp(self):
        self.mock_fred_patcher = patch('backend.services.macro.Fred')
        self.mock_fred_cls = self.mock_fred_patcher.start()
        self.mock_fred_instance = self.mock_fred_cls.return_value
        
    def tearDown(self):
        self.mock_fred_patcher.stop()



    def test_get_debt_status_calculation(self):
        service = MacroService()
        
        # Mock fetch_series for Interest and Tax
        interest_dates = pd.to_datetime(['2023-01-01', '2023-04-01'])
        interest_series = pd.Series([50.0, 60.0], index=interest_dates)

        tax_dates = pd.to_datetime(['2023-01-01', '2023-04-01'])
        tax_series = pd.Series([100.0, 120.0], index=tax_dates)
        
        # Mock _get_series to return our fake data without hitting FRED or Cache
        service._get_series = MagicMock(side_effect=lambda x: 
            interest_series if x == 'A091RC1Q027SBEA' else 
            (tax_series if x == 'W006RC1Q027SBEA' else pd.Series(dtype=float))
        )
        
        result = service.get_debt_status()
        
        # Check if we got results
        self.assertTrue(len(result) > 0)
        
        # Sort by date usually done in method, but find specific date
        jan_entry = next((item for item in result if item.date == '2023-01-01'), None)
        self.assertIsNotNone(jan_entry)
        # Interest 50 / Tax 100 * 100 = 50.0
        self.assertAlmostEqual(jan_entry.ratio, 50.0)
        
        apr_entry = next((item for item in result if item.date == '2023-04-01'), None)
        self.assertIsNotNone(apr_entry)
        # Interest 60 / Tax 120 * 100 = 50.0
        self.assertAlmostEqual(apr_entry.ratio, 50.0)

    def test_get_liquidity_growth(self):
        service = MacroService()
        
        # M2 data for 13 months to get 1 growth point
        # Jan 2022 to Jan 2023
        dates = pd.date_range(start='2022-01-01', periods=13, freq='MS')
        vals = [100.0] * 12 + [110.0] # 10% growth on 13th month relative to 1st
        m2_series = pd.Series(vals, index=dates)
        
        service._get_series = MagicMock(return_value=m2_series)
        
        result = service.get_liquidity()
        
        # Should have 1 record
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].date, '2023-01-01')
        self.assertAlmostEqual(result[0].growth_rate, 0.1)
        self.assertEqual(result[0].value, 110.0)

if __name__ == '__main__':
    unittest.main()
