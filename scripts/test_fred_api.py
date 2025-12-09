"""Test FRED API connectivity using standard library (no extra deps).
Fetches CPI (CPIAUCSL), M2 (M2SL), and 10yr yield (DGS10) recent observations.
Run with the project's venv python:

/absolute/path/to/venv/bin/python scripts/test_fred_api.py
"""
import json
import os
import urllib.parse
import urllib.request
from datetime import date, timedelta

from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv('FRED_API_KEY')
if not API_KEY:
    raise SystemExit("FRED_API_KEY not found in environment. Create .env with FRED_API_KEY=...")

BASE = "https://api.stlouisfed.org/fred/series/observations"
SERIES = {
    'CPI': 'CPIAUCSL',
    'M2': 'M2SL',
    '10Y': 'DGS10',
}

# Use observation_start 2 years ago to get some data
start = (date.today() - timedelta(days=2 * 365)).isoformat()
params_common = {
    'api_key': API_KEY,
    'file_type': 'json',
    'observation_start': start,
}

def fetch_series(series_id):
    params = params_common.copy()
    params['series_id'] = series_id
    url = BASE + '?' + urllib.parse.urlencode(params)
    # print(f"Requesting: {url}")
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            text = r.read().decode('utf-8')
            data = json.loads(text)
            return data
    except Exception as e:
        return {'error': str(e)}

if __name__ == '__main__':
    for name, sid in SERIES.items():
        print(f"\n--- {name} ({sid}) ---")
        data = fetch_series(sid)
        if 'error' in data:
            print("Error:", data['error'])
            continue
        if data.get('observations') is None:
            print("No observations returned; full response keys:", list(data.keys()))
            continue
        obs = data['observations']
        print(f"Observations returned: {len(obs)}")
        # show the last 3 non-null value observations
        last_vals = [o for o in reversed(obs) if o.get('value') not in ('.', None, '')]
        sample = last_vals[:3]
        if not sample:
            print("No numeric observations found in recent data.")
        else:
            for o in sample:
                print(o['date'], o['value'])
    print('\nDone')
