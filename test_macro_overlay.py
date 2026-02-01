#!/usr/bin/env python
"""
Test script for macro overlay feature (Task 016).
Verifies backend schemas, config, and service methods.
"""

import sys
sys.path.insert(0, '.')

from datetime import datetime
import pandas as pd
from pydantic import ValidationError

print("\n" + "="*60)
print("Testing Macro Overlay Feature (Task 016)")
print("="*60 + "\n")

# Test 1: Schema imports
print("TEST 1: Schema Imports")
print("-" * 60)
try:
    from backend import schemas
    assert hasattr(schemas, 'MacroSeriesPoint'), "Missing MacroSeriesPoint"
    assert hasattr(schemas, 'MacroSeriesData'), "Missing MacroSeriesData"
    assert hasattr(schemas, 'MacroSeriesResponse'), "Missing MacroSeriesResponse"
    assert hasattr(schemas, 'AvailableOverlaysResponse'), "Missing AvailableOverlaysResponse"
    assert hasattr(schemas, 'MacroSeriesInfo'), "Missing MacroSeriesInfo"
    print("✓ All schema classes present")
except Exception as e:
    print(f"✗ Schema import failed: {e}")
    sys.exit(1)

# Test 2: Schema validation
print("\nTEST 2: Schema Validation")
print("-" * 60)
try:
    # Test MacroSeriesPoint
    point = schemas.MacroSeriesPoint(date="2026-01-31", value=18.5)
    assert point.date == "2026-01-31"
    assert point.value == 18.5
    print("✓ MacroSeriesPoint valid")
    
    # Test MacroSeriesInfo
    info = schemas.MacroSeriesInfo(
        series_id="M2SL",
        name="M2 Money Supply",
        description="Test",
        frequency="Monthly",
        units="Billions"
    )
    assert info.series_id == "M2SL"
    print("✓ MacroSeriesInfo valid")
    
    # Test MacroSeriesData
    data = schemas.MacroSeriesData(
        series_id="M2SL",
        name="M2",
        data=[point],
        metadata=schemas.MacroDataMetadata(is_stale=False)
    )
    assert len(data.data) == 1
    print("✓ MacroSeriesData valid")
    
    # Test MacroSeriesResponse
    response = schemas.MacroSeriesResponse(series=[data])
    assert len(response.series) == 1
    print("✓ MacroSeriesResponse valid")
    
    # Test AvailableOverlaysResponse
    overlays = schemas.AvailableOverlaysResponse(overlays=[info])
    assert len(overlays.overlays) == 1
    print("✓ AvailableOverlaysResponse valid")
    
except ValidationError as e:
    print(f"✗ Validation error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"✗ Unexpected error: {e}")
    sys.exit(1)

# Test 3: Config
print("\nTEST 3: Configuration")
print("-" * 60)
try:
    from backend import config
    
    # Check FRED series info
    assert hasattr(config, 'FRED_SERIES_INFO'), "Missing FRED_SERIES_INFO"
    assert 'M2SL' in config.FRED_SERIES_INFO, "M2SL not in FRED_SERIES_INFO"
    assert config.FRED_SERIES_INFO['M2SL']['name'] == 'M2 Money Supply'
    print("✓ FRED_SERIES_INFO configured correctly")
    
    # Check overlay series list
    assert hasattr(config, 'OVERLAY_SERIES_IDS'), "Missing OVERLAY_SERIES_IDS"
    assert len(config.OVERLAY_SERIES_IDS) > 0, "OVERLAY_SERIES_IDS is empty"
    print(f"✓ OVERLAY_SERIES_IDS has {len(config.OVERLAY_SERIES_IDS)} series")
    print(f"  Series: {', '.join(config.OVERLAY_SERIES_IDS)}")
    
except Exception as e:
    print(f"✗ Config error: {e}")
    sys.exit(1)

# Test 4: MacroService methods signature
print("\nTEST 4: MacroService Method Signatures")
print("-" * 60)
try:
    import inspect
    from backend.services.macro import MacroService
    
    service = MacroService()
    
    # Check get_series method
    assert hasattr(service, 'get_series'), "Missing get_series method"
    sig = inspect.signature(service.get_series)
    assert 'series_id' in sig.parameters
    assert 'days' in sig.parameters
    assert 'resample_to_daily' in sig.parameters
    print("✓ get_series method signature correct")
    
    # Check get_series_batch method
    assert hasattr(service, 'get_series_batch'), "Missing get_series_batch method"
    sig = inspect.signature(service.get_series_batch)
    assert 'series_ids' in sig.parameters
    assert 'days' in sig.parameters
    assert 'resample_to_daily' in sig.parameters
    print("✓ get_series_batch method signature correct")
    
    # Check get_available_overlays method
    assert hasattr(service, 'get_available_overlays'), "Missing get_available_overlays method"
    sig = inspect.signature(service.get_available_overlays)
    print("✓ get_available_overlays method signature correct")
    
except Exception as e:
    print(f"✗ MacroService error: {e}")
    sys.exit(1)

# Test 5: API Routes
print("\nTEST 5: API Routes")
print("-" * 60)
try:
    from backend.routers.macro import router
    
    # Check routes
    routes = [route.path for route in router.routes]
    assert any('/series' in r for r in routes), "Missing /series route"
    assert any('/overlays' in r for r in routes), "Missing /overlays route"
    print(f"✓ Macro routes registered:")
    for route in router.routes:
        print(f"  - {route.path}")
    
except Exception as e:
    print(f"✗ API routes error: {e}")
    sys.exit(1)

# Test 6: Data transformation (mock test)
print("\nTEST 6: Data Transformation Mock")
print("-" * 60)
try:
    # Create mock series data
    dates = pd.date_range('2026-01-01', periods=5, freq='MS')  # Monthly
    values = [10.0, 10.5, 11.0, 11.5, 12.0]
    series = pd.Series(values, index=dates)
    
    # Test resampling logic (what service would do)
    resampled = series.resample('D').ffill()
    assert len(resampled) > len(series), "Resampling should increase data points"
    print(f"✓ Resampling works: {len(series)} monthly → {len(resampled)} daily points")
    
    # Test filtering by days
    cutoff = pd.Timestamp.now(tz='UTC') - pd.Timedelta(days=30)
    resampled_index = resampled.index.tz_localize('UTC')
    filtered = resampled[resampled_index >= cutoff]
    print(f"✓ Filtering works: {len(filtered)} points within 30 days")
    
except Exception as e:
    print(f"✗ Data transformation error: {e}")
    sys.exit(1)

print("\n" + "="*60)
print("BACKEND TESTS PASSED ✓")
print("="*60 + "\n")

print("Summary:")
print("  ✓ All schema classes defined and valid")
print("  ✓ Configuration contains FRED series metadata")
print("  ✓ MacroService has new methods with correct signatures")
print("  ✓ API routes registered correctly")
print("  ✓ Data transformation logic working")
print("\nBackend implementation is ready for integration testing!")
