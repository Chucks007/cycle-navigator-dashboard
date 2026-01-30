"""
Unit tests for error logging in StockService batch operations.

Tests verify that per-ticker errors in _calculate_batch_deltas are logged
with tracebacks while allowing other tickers to continue processing.
"""

import logging
import pandas as pd
import pytest

from backend.services.stock_service import StockService


def test_calculate_batch_deltas_logs_exception_and_continues(caplog):
    """
    Test that _calculate_batch_deltas logs errors with traceback for failing tickers
    while successfully processing valid tickers.
    """
    service = StockService()
    
    # Create a MultiIndex DataFrame simulating yfinance batch output
    # Two tickers: GOOD (valid data) and BAD (malformed data causing exception)
    dates = pd.date_range("2026-01-28", periods=2, freq="D")
    
    # Build multi-level columns structure
    columns = pd.MultiIndex.from_product(
        [['GOOD', 'BAD'], ['Open', 'High', 'Low', 'Close', 'Volume']],
        names=['Ticker', 'Price']
    )
    
    data = pd.DataFrame(index=dates, columns=columns)
    
    # GOOD ticker: valid numeric data
    data[('GOOD', 'Close')] = [100.0, 101.0]
    data[('GOOD', 'Open')] = [99.0, 100.5]
    data[('GOOD', 'High')] = [101.0, 102.0]
    data[('GOOD', 'Low')] = [98.0, 100.0]
    data[('GOOD', 'Volume')] = [1000000, 1100000]
    
    # BAD ticker: previous close is non-numeric to trigger exception
    data[('BAD', 'Close')] = ["not-a-number", 110.0]
    data[('BAD', 'Open')] = [108.0, 109.0]
    data[('BAD', 'High')] = [111.0, 112.0]
    data[('BAD', 'Low')] = [107.0, 108.0]
    data[('BAD', 'Volume')] = [500000, 600000]
    
    # Set log level to capture ERROR
    with caplog.at_level(logging.ERROR):
        results = service._calculate_batch_deltas(data, ['GOOD', 'BAD'])
    
    # Verify GOOD ticker was processed successfully
    assert 'GOOD' in results
    assert results['GOOD']['price'] == 101.0
    assert results['GOOD']['delta'] == 1.0
    assert results['GOOD']['pct_delta'] == 1.0
    
    # Verify BAD ticker was skipped (not in results)
    assert 'BAD' not in results
    
    # Verify error was logged with the ticker name
    assert len(caplog.records) >= 1
    error_records = [r for r in caplog.records if r.levelname == 'ERROR' and 'BAD' in r.message]
    assert len(error_records) >= 1
    
    # Verify traceback was attached (exc_info is not None)
    assert error_records[0].exc_info is not None
    assert "Error processing ticker BAD" in error_records[0].message


def test_calculate_batch_deltas_single_ticker_with_error(caplog):
    """
    Test error logging when processing a single ticker (different data structure).
    """
    service = StockService()
    
    # Single ticker has flat structure (no MultiIndex)
    dates = pd.date_range("2026-01-28", periods=2, freq="D")
    data = pd.DataFrame(
        {
            'Open': [99.0, 100.5],
            'High': [101.0, 102.0],
            'Low': [98.0, 100.0],
            'Close': ["invalid", 101.0],  # Invalid previous close
            'Volume': [1000000, 1100000]
        },
        index=dates
    )
    
    with caplog.at_level(logging.ERROR):
        results = service._calculate_batch_deltas(data, ['SINGLE'])
    
    # Should return empty results
    assert 'SINGLE' not in results
    
    # Should log error
    error_records = [r for r in caplog.records if r.levelname == 'ERROR']
    assert len(error_records) >= 1
    assert error_records[0].exc_info is not None


def test_calculate_batch_deltas_all_valid_no_errors(caplog):
    """
    Test that no errors are logged when all tickers process successfully.
    """
    service = StockService()
    
    dates = pd.date_range("2026-01-28", periods=2, freq="D")
    columns = pd.MultiIndex.from_product(
        [['AAPL', 'MSFT'], ['Open', 'High', 'Low', 'Close', 'Volume']],
        names=['Ticker', 'Price']
    )
    
    data = pd.DataFrame(index=dates, columns=columns)
    
    # Both tickers: valid data
    data[('AAPL', 'Close')] = [150.0, 152.0]
    data[('AAPL', 'Open')] = [149.0, 151.0]
    data[('AAPL', 'High')] = [153.0, 154.0]
    data[('AAPL', 'Low')] = [148.0, 150.0]
    data[('AAPL', 'Volume')] = [1000000, 1100000]
    
    data[('MSFT', 'Close')] = [300.0, 305.0]
    data[('MSFT', 'Open')] = [299.0, 304.0]
    data[('MSFT', 'High')] = [306.0, 307.0]
    data[('MSFT', 'Low')] = [298.0, 303.0]
    data[('MSFT', 'Volume')] = [2000000, 2100000]
    
    with caplog.at_level(logging.ERROR):
        results = service._calculate_batch_deltas(data, ['AAPL', 'MSFT'])
    
    # Both tickers should be processed
    assert 'AAPL' in results
    assert 'MSFT' in results
    
    # No errors should be logged
    error_records = [r for r in caplog.records if r.levelname == 'ERROR']
    assert len(error_records) == 0
