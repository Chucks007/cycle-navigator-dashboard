"""Small helper to verify .env is loaded.
Run with the project's venv python, e.g.:

/absolute/path/to/venv/bin/python scripts/verify_env.py
"""
import os

from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv('FRED_API_KEY')
print(f"FRED_API_KEY: {api_key}")
print(f"Key length: {len(api_key) if api_key else 0}")
