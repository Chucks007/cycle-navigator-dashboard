# Real Time Stock Price Dashboard

This was originally made for my grandmother who loves investing :)

This project is a real-time full-stack stock price dashboard built using Python, Streamlit, Plotly, and various financial data analysis tools. The dashboard allows users to visualize stock prices, apply technical indicators such as SMA 20, EMA20, and RSI14, and monitor real-time prices of selected stocks.

*Enjoy a stock price dashboard that you can run right in your terminal*!

https://github.com/user-attachments/assets/73e8ccaa-fba7-4288-9af2-376f0964c727

## Directory Structure

```
Real_Time_Stock_Price_Dashboard/
├── stock_dashboard.py
├── requirements.txt
```markdown
# Cycle Navigator — Real-Time Stock Dashboard

Small, opinionated Streamlit dashboard for viewing stock prices, basic technical indicators, and simple verification scripts. Originally created as a lightweight tool to monitor equities (candlesticks, SMA/EMA/RSI) and to exercise some automation checks.

This repo contains:

- `stock_dashboard.py` — Streamlit app (main UI).
- `backend/` — FastAPI helpers and small API that re-uses the same data functions.
- `scripts/playwright/` — Playwright test that opens the Streamlit app and captures screenshots into `artifacts/`.
- `scripts/test_fred_api.py` and `scripts/verify_env.py` — small helpers for verifying FRED API connectivity and environment variables.
- `requirements.txt` and `backend/requirements.txt` — Python dependencies.

**Quick goals**: run the Streamlit app locally, optionally run the small FastAPI backend, and verify UI behavior with the Playwright script.

**Note:** this README was updated to reflect the current structure and run instructions.

---

## Requirements

- Python 3.8+ (3.10/3.11 recommended)
- A virtualenv or venv for dependency isolation
- Optional: Playwright to run the end-to-end script (`scripts/playwright/test_dashboard.py`)

Install system-level packages and create a virtual environment (example using `fish`):

```fish
python -m venv venv
source venv/bin/activate.fish
pip install --upgrade pip
pip install -r requirements.txt
```

If you plan to run the backend service, also install backend deps:

```fish
pip install -r backend/requirements.txt
```

If you want to run the Playwright-based UI test, install Playwright in the venv and download browsers:

```fish
pip install playwright
python -m playwright install chromium
```

---

## Running the Streamlit dashboard (frontend)

Run the Streamlit app from the repository root (from the activated venv):

```fish
venv/bin/streamlit run stock_dashboard.py
```

Open `http://localhost:8501` in your browser (Streamlit prints the local and network URLs when it starts).

Sidebar controls summary:

- `Ticker` — stock symbol (e.g. `AAPL`).
- `Time Period` — periods supported by `yfinance` (e.g. `1d`, `5d`, `1mo`, `max`).
- `Chart Type` — `Candlestick` or `Line`.
- `Technical Indicators` — `SMA 20`, `EMA 20`, `RSI 14` (add them then click `Update`).

The app also shows a small list of real-time prices in the sidebar for `AAPL`, `GOOGL`, `AMZN`, and `MSFT`.

---

## Running the backend (optional)

The `backend/` package contains a FastAPI app that exposes a few endpoints which wrap the same data functions:

- `GET /api/stock/{ticker}` — basic metrics
- `GET /api/stock/{ticker}/history` — historical OHLCV data
- `GET /api/stock/{ticker}/indicators` — SMA/EMA/RSI

Start the server (from repo root, venv active):

```fish
uvicorn backend.main:app --reload --port 8000
```

CORS is configured to allow `http://localhost:5173` by default (Vite dev server). Adjust `backend/main.py` if you need other origins.

---

## Playwright UI test

The Playwright script exercises the Streamlit UI and saves screenshots to the `artifacts/` folder.

Run it after the Streamlit app is running:

```fish
python scripts/playwright/test_dashboard.py
```

Notes:

- If Playwright raises an error about missing browsers, run `python -m playwright install chromium` (or `python -m playwright install` to install all supported browsers).
- The script captures screenshots into `artifacts/`.

---

## FRED API helpers

This project includes small scripts that require a FRED API key (optional):

- Create a `.env` file with `FRED_API_KEY=your_key_here` or export `FRED_API_KEY` in your environment.
- `scripts/verify_env.py` prints the loaded key for quick verification.
- `scripts/test_fred_api.py` fetches CPI, M2, and 10Y yield series using the public FRED REST API.

Example:

```fish
# Create .env in repo root with: FRED_API_KEY=xxxx
python scripts/verify_env.py
python scripts/test_fred_api.py
```

---

## Troubleshooting

- Playwright browser error: if you see an error like "Executable doesn't exist" or a message asking you to run `playwright install`, run:

  ```fish
  python -m playwright install chromium
  ```

- Connection refused during Playwright `page.goto`: ensure the Streamlit app is running at `http://localhost:8501` before starting the test.

- Windows CRLF / script shebang issues: On Windows, shell scripts can have CRLF endings which break shebangs inside Linux containers; to avoid this the repo includes a `.gitattributes` that enforces LF for `*.sh`, and the `Containerfile` normalizes `start.sh` during image build.

- yfinance returns empty data: verify the ticker symbol and try a different `period`/`interval`. Network issues or rate-limiting can also cause empty responses.

---

## Development notes

- Core data logic is implemented in `backend/services.py` and reused by both the Streamlit app and the FastAPI routes to avoid duplication.
- Technical indicators use the `ta` library; results may include NaNs for very short series (the code currently fills NaNs with zeros before returning JSON from the backend).

---

## Contributing

Contributions welcome — open an issue or a PR. Please include a short description and tests where appropriate.

---

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

## Contact

For questions, open an issue or contact the maintainer in the repository.

```
