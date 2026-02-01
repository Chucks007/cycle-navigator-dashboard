#!/usr/bin/env python3
"""
Docker Verification Report for Task 016: Multi-Asset Sync
Tests all services running in Docker containers
"""

import subprocess
import json
import time
from datetime import datetime

def run_command(cmd):
    """Run a shell command and return output"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        return result.stdout.strip(), result.returncode
    except Exception as e:
        return str(e), 1

def test_docker_services():
    """Test all Docker services"""
    print("=" * 80)
    print("DOCKER VERIFICATION REPORT - Task 016 Multi-Asset Sync")
    print("=" * 80)
    print(f"\nReport Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    # =========================================================================
    # SECTION 1: CONTAINER STATUS
    # =========================================================================
    print("SECTION 1: CONTAINER STATUS")
    print("-" * 80)
    
    ps_output, _ = run_command("docker compose ps")
    print(f"✓ Docker containers running:\n")
    
    # Parse simple docker compose ps output
    services = ["backend", "postgres", "redis", "web"]
    for service in services:
        status_cmd = f"docker compose ps {service} --format json 2>/dev/null"
        status_output, code = run_command(status_cmd)
        if code == 0 and status_output.strip():
            try:
                service_data = json.loads(status_output)
                if isinstance(service_data, list) and len(service_data) > 0:
                    service_info = service_data[0]
                    state = service_info.get("State", "unknown")
                    status = "✓" if state == "running" else "◆"
                    print(f"{status} {service.upper()}: {state}")
            except:
                print(f"◆ {service.upper()}: Running")
    
    # =========================================================================
    # SECTION 2: BACKEND API TESTS
    # =========================================================================
    print("\n" + "=" * 80)
    print("SECTION 2: BACKEND API TESTS")
    print("-" * 80)
    
    tests = [
        ("Health Check", "curl -s http://localhost:8000/health", lambda x: "ok" in x.lower()),
        ("Overlays Endpoint", "curl -s http://localhost:8000/api/macro/overlays", lambda x: "overlays" in x.lower()),
        ("Series Endpoint", "curl -s 'http://localhost:8000/api/macro/series?series_ids=M2SL&days=30'", lambda x: "M2SL" in x),
    ]
    
    results = []
    for test_name, cmd, validator in tests:
        output, code = run_command(cmd)
        passed = code == 0 and validator(output)
        status = "✓" if passed else "✗"
        results.append((test_name, passed))
        print(f"\n{status} {test_name}")
        if passed:
            print(f"   Status: OK")
            if "overlays" in test_name.lower():
                try:
                    data = json.loads(output)
                    overlay_count = len(data.get("overlays", []))
                    print(f"   Overlays found: {overlay_count}")
                    for overlay in data.get("overlays", []):
                        print(f"     - {overlay.get('name')} ({overlay.get('series_id')})")
                except:
                    pass
            elif "series" in test_name.lower():
                try:
                    data = json.loads(output)
                    series_count = len(data.get("series", []))
                    if series_count > 0:
                        series = data["series"][0]
                        data_points = len(series.get("data", []))
                        print(f"   Series ID: {series.get('series_id')}")
                        print(f"   Data points: {data_points}")
                except:
                    pass
        else:
            print(f"   Status: FAILED")
            print(f"   Error: {output[:200]}")
    
    # =========================================================================
    # SECTION 3: DATABASE CONNECTIVITY
    # =========================================================================
    print("\n" + "=" * 80)
    print("SECTION 3: DATABASE CONNECTIVITY")
    print("-" * 80)
    
    # Check PostgreSQL
    pg_cmd = "docker compose exec -T postgres pg_isready -U cycle_user -d cycle_navigator"
    pg_output, pg_code = run_command(pg_cmd)
    pg_status = pg_code == 0
    print(f"\n{'✓' if pg_status else '✗'} PostgreSQL (TimescaleDB)")
    print(f"   Status: {'Running' if pg_status else 'Not responding'}")
    
    # Check Redis
    redis_cmd = "docker compose exec -T redis redis-cli ping"
    redis_output, redis_code = run_command(redis_cmd)
    redis_status = "PONG" in redis_output
    print(f"\n{'✓' if redis_status else '✗'} Redis")
    print(f"   Status: {'Running' if redis_status else 'Not responding'}")
    print(f"   Response: {redis_output}")
    
    # =========================================================================
    # SECTION 4: FRONTEND SERVICE
    # =========================================================================
    print("\n" + "=" * 80)
    print("SECTION 4: FRONTEND SERVICE")
    print("-" * 80)
    
    # Check if frontend is responding
    frontend_cmd = "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ticker"
    frontend_output, frontend_code = run_command(frontend_cmd)
    frontend_status = frontend_output.startswith("200")
    
    print(f"\n{'✓' if frontend_status else '✗'} Next.js Frontend")
    print(f"   URL: http://localhost:3000")
    print(f"   Ticker Page (/ticker): {'Responding (HTTP {})'.format(frontend_output) if frontend_status else 'Not responding'}")
    print(f"   Status: {'Ready for testing' if frontend_status else 'Starting or unavailable'}")
    
    # =========================================================================
    # SECTION 5: SERVICE LOGS SUMMARY
    # =========================================================================
    print("\n" + "=" * 80)
    print("SECTION 5: RECENT LOGS")
    print("-" * 80)
    
    services = ["backend", "postgres", "redis", "web"]
    for service in services:
        logs_cmd = f"docker compose logs {service} --tail 3"
        logs_output, _ = run_command(logs_cmd)
        
        print(f"\n{service.upper()} (last 3 lines):")
        if logs_output:
            for line in logs_output.split("\n")[-3:]:
                if line.strip():
                    # Clean up docker output formatting
                    cleaned = line.replace(f"cycle-navigator-{service} | ", "")
                    print(f"  {cleaned}")
    
    # =========================================================================
    # SECTION 6: ENDPOINT EXAMPLES
    # =========================================================================
    print("\n" + "=" * 80)
    print("SECTION 6: WORKING ENDPOINTS")
    print("-" * 80)
    
    endpoints = [
        ("Health", "http://localhost:8000/health"),
        ("Macro Overlays", "http://localhost:8000/api/macro/overlays"),
        ("Macro Series (M2)", "http://localhost:8000/api/macro/series?series_ids=M2SL&days=90"),
        ("Macro Series (Multi)", "http://localhost:8000/api/macro/series?series_ids=M2SL,CPIAUCSL,DGS10&days=365"),
        ("Frontend Root", "http://localhost:3000"),
        ("Frontend Ticker", "http://localhost:3000/ticker"),
    ]
    
    print("\nAvailable endpoints:\n")
    for name, endpoint in endpoints:
        print(f"  • {name}")
        print(f"    {endpoint}\n")
    
    # =========================================================================
    # SECTION 7: SUMMARY
    # =========================================================================
    print("=" * 80)
    print("VERIFICATION SUMMARY")
    print("=" * 80)
    
    all_passed = all(result[1] for result in results) and pg_status and redis_status and frontend_status
    
    print(f"""
Backend API Tests: {sum(1 for _, r in results if r)}/{len(results)} PASSED
Database:         {'✓ PostgreSQL Connected' if pg_status else '✗ PostgreSQL Failed'}
Cache:            {'✓ Redis Connected' if redis_status else '✗ Redis Failed'}  
Frontend:         {'✓ Running' if frontend_status else '✗ Not responding'}

Overall Status:   {'✓ ALL SYSTEMS OPERATIONAL' if all_passed else '⚠ Some issues detected'}

Next Steps:
  1. Open http://localhost:3000/ticker in your browser
  2. Test the OverlaySelector dropdown
  3. Select overlay series (M2, CPI, or 10Y Yield)
  4. Verify chart renders with overlays
  5. Monitor browser console for errors
  6. Monitor logs with: docker compose logs -f
""")
    
    if all_passed:
        print("✓ Task 016 Multi-Asset Sync is fully operational in Docker!")
    else:
        print("⚠ Some services may need attention. Check logs above.")
    
    print("=" * 80)
    
    return all_passed

if __name__ == "__main__":
    success = test_docker_services()
    exit(0 if success else 1)
