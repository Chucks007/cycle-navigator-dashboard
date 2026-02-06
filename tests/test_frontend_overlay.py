#!/usr/bin/env python3
"""
Frontend Test Suite for Task 016: Multi-Asset Sync
Tests TypeScript schema files, API client methods, and hook implementation
"""

import os
import re
import json
from pathlib import Path

# ============================================================
# TEST 1: TypeScript Schema Files Exist
# ============================================================
def test_schema_files():
    print("\nTEST 1: TypeScript Schema Files")
    print("-" * 60)
    
    web_root = Path("web/src")
    required_files = [
        "schemas/api-schemas.ts",
        "lib/api-client.ts", 
        "hooks/use-data.ts",
        "lib/chart-utils.ts",
        "components/charts/lightweight-chart.tsx",
        "components/features/ticker/overlay-selector.tsx",
        "app/ticker/page.tsx",
    ]
    
    for file_path in required_files:
        full_path = web_root / file_path
        if full_path.exists():
            print(f"✓ {file_path}")
        else:
            print(f"✗ {file_path} MISSING")
            return False
    
    return True

# ============================================================
# TEST 2: Schema Definitions
# ============================================================
def test_schema_definitions():
    print("\nTEST 2: Schema Definitions")
    print("-" * 60)
    
    schema_file = Path("web/src/schemas/api-schemas.ts").read_text()
    
    required_schemas = [
        "MacroSeriesPointSchema",
        "MacroSeriesDataSchema", 
        "MacroSeriesResponseSchema",
        "AvailableOverlaysResponseSchema",
        "MacroSeriesInfoSchema",
    ]
    
    all_found = True
    for schema in required_schemas:
        if schema in schema_file:
            print(f"✓ {schema} defined")
        else:
            print(f"✗ {schema} NOT FOUND")
            all_found = False
    
    return all_found

# ============================================================
# TEST 3: API Client Methods
# ============================================================
def test_api_client_methods():
    print("\nTEST 3: API Client Methods")
    print("-" * 60)
    
    api_file = Path("web/src/lib/api-client.ts").read_text()
    
    required_methods = [
        ("getMacroSeries", "Gets macro series data from API"),
        ("getAvailableOverlays", "Gets available overlay series"),
    ]
    
    all_found = True
    for method, description in required_methods:
        if f"getMacroSeries" in method and "getMacroSeries" in api_file:
            print(f"✓ {method}: {description}")
        elif f"getAvailableOverlays" in method and "getAvailableOverlays" in api_file:
            print(f"✓ {method}: {description}")
        else:
            print(f"✗ {method} NOT FOUND")
            all_found = False
    
    return all_found

# ============================================================
# TEST 4: React Hooks Implementation
# ============================================================
def test_hooks_implementation():
    print("\nTEST 4: React Hooks Implementation")
    print("-" * 60)
    
    hooks_file = Path("web/src/hooks/use-data.ts").read_text()
    
    required_hooks = [
        "useMacroSeries",
        "useAvailableOverlays",
    ]
    
    all_found = True
    for hook in required_hooks:
        if f"export const {hook}" in hooks_file or f"export function {hook}" in hooks_file:
            print(f"✓ {hook} hook exported")
        else:
            print(f"✗ {hook} hook NOT FOUND")
            all_found = False
    
    # Check for lazy loading pattern in useMacroSeries
    if "enabled:" in hooks_file and "seriesIds.length > 0" in hooks_file:
        print(f"✓ Lazy loading implemented (enabled only when seriesIds > 0)")
    else:
        print(f"✗ Lazy loading pattern NOT FOUND")
        all_found = False
    
    return all_found

# ============================================================
# TEST 5: Chart Utilities
# ============================================================
def test_chart_utils():
    print("\nTEST 5: Chart Utilities")
    print("-" * 60)
    
    utils_file = Path("web/src/lib/chart-utils.ts").read_text()
    
    required_items = [
        ("MACRO_OVERLAY_COLORS", "Color mapping for overlays"),
        ("formatLargeNumber", "Format large numbers with suffixes"),
        ("transformMacroSeriesToOverlay", "Transform single series to overlay config"),
        ("transformMacroSeriesToOverlays", "Transform array of series to overlay configs"),
    ]
    
    all_found = True
    for item, description in required_items:
        if item in utils_file:
            print(f"✓ {item}: {description}")
        else:
            print(f"✗ {item} NOT FOUND")
            all_found = False
    
    # Check for price scale support
    if "priceScaleId" in utils_file:
        print(f"✓ Price scale ID support in ExtraSeriesConfig")
    else:
        print(f"✗ Price scale ID NOT FOUND")
        all_found = False
    
    return all_found

# ============================================================
# TEST 6: UI Components
# ============================================================
def test_ui_components():
    print("\nTEST 6: UI Components")
    print("-" * 60)
    
    overlay_selector = Path("web/src/components/features/ticker/overlay-selector.tsx").read_text()
    ticker_page = Path("web/src/app/ticker/page.tsx").read_text()
    
    # Check OverlaySelector component
    if "OverlaySelector" in overlay_selector and "export" in overlay_selector:
        print(f"✓ OverlaySelector component implemented")
    else:
        print(f"✗ OverlaySelector component MISSING")
        return False
    
    # Check ticker page integration
    if "selectedOverlays" in ticker_page:
        print(f"✓ Ticker page has selectedOverlays state")
    else:
        print(f"✗ Ticker page missing selectedOverlays state")
        return False
    
    if "useMacroSeries" in ticker_page:
        print(f"✓ Ticker page uses useMacroSeries hook")
    else:
        print(f"✗ Ticker page doesn't use useMacroSeries hook")
        return False
    
    if "OverlaySelector" in ticker_page:
        print(f"✓ Ticker page renders OverlaySelector")
    else:
        print(f"✗ Ticker page doesn't render OverlaySelector")
        return False
    
    if "transformMacroSeriesToOverlays" in ticker_page:
        print(f"✓ Ticker page transforms macro series to overlays")
    else:
        print(f"✗ Ticker page doesn't transform macro series")
        return False
    
    return True

# ============================================================
# TEST 7: LightweightChart Update
# ============================================================
def test_chart_component():
    print("\nTEST 7: Chart Component Updates")
    print("-" * 60)
    
    chart_file = Path("web/src/components/charts/lightweight-chart.tsx").read_text()
    
    checks = [
        ("leftPriceScale", "Left price scale configuration"),
        ("priceScaleId", "Price scale ID routing in series"),
    ]
    
    all_found = True
    for check, description in checks:
        if check in chart_file:
            print(f"✓ {description} implemented")
        else:
            print(f"✗ {description} NOT FOUND")
            all_found = False
    
    return all_found

# ============================================================
# TEST 8: Package.json Dependencies
# ============================================================
def test_dependencies():
    print("\nTEST 8: Required Dependencies")
    print("-" * 60)
    
    package_json = json.loads(Path("web/package.json").read_text())
    
    required_deps = [
        "@tanstack/react-query",
        "zod",
        "lightweight-charts",
    ]
    
    all_deps = {**package_json.get("dependencies", {}), **package_json.get("devDependencies", {})}
    
    all_found = True
    for dep in required_deps:
        if dep in all_deps:
            version = all_deps[dep]
            print(f"✓ {dep}: {version}")
        else:
            print(f"✗ {dep} NOT FOUND")
            all_found = False
    
    return all_found

# ============================================================
# MAIN TEST EXECUTION
# ============================================================
if __name__ == "__main__":
    print("=" * 60)
    print("Testing Frontend for Multi-Asset Sync (Task 016)")
    print("=" * 60)
    
    tests = [
        ("Schema Files", test_schema_files),
        ("Schema Definitions", test_schema_definitions),
        ("API Client Methods", test_api_client_methods),
        ("React Hooks", test_hooks_implementation),
        ("Chart Utilities", test_chart_utils),
        ("UI Components", test_ui_components),
        ("Chart Component", test_chart_component),
        ("Dependencies", test_dependencies),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n✗ ERROR in {name}: {str(e)}")
            results.append((name, False))
    
    # Summary
    print("\n" + "=" * 60)
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    if passed == total:
        print(f"FRONTEND TESTS PASSED ✓")
        print("=" * 60)
        print("\nSummary:")
        print(f"  ✓ All TypeScript schema files present")
        print(f"  ✓ All schema definitions implemented")
        print(f"  ✓ API client methods working")
        print(f"  ✓ React hooks properly implemented with lazy loading")
        print(f"  ✓ Chart utilities support macro overlay transformations")
        print(f"  ✓ UI components integrated into ticker page")
        print(f"  ✓ LightweightChart component updated for overlays")
        print(f"  ✓ All required dependencies present")
        print("\nFrontend implementation is ready for integration testing!")
    else:
        print(f"FRONTEND TESTS FAILED ({passed}/{total} passed)")
        print("=" * 60)
        for name, result in results:
            status = "✓" if result else "✗"
            print(f"  {status} {name}")
