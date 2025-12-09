# CHANGELOG

All notable changes to this project are documented in this file.

## 2025-12-07 — Application Containerization

**Summary**
- Containerized the application using Podman to provide a stable, isolated, and reproducible runtime environment. This protects the application from host system updates and simplifies setup.
- The single container runs both the Streamlit frontend and the FastAPI backend concurrently.

**Files Changed**
- `Containerfile`: Added to define the build process for the Podman image.
- `start.sh`: A new script to launch both the Uvicorn and Streamlit servers within the container.
- `.dockerignore`: Added to exclude unnecessary files from the container image, keeping it lightweight.
- `requirements.txt`: Consolidated all frontend and backend dependencies into a single file.
- `backend/requirements.txt`: Deleted after its contents were merged.
- `backend/main.py`: Corrected a module import to use a relative path, ensuring compatibility with the container's execution context.
- `.gitignore`: Added `streamlit.log` to the ignore list.

**How to Run**
- **Build:** `podman build -t cycle-navigator-dashboard .`
- **Run:** `podman run -p 8000:8000 -p 8501:8501 -d --name cycle-navigator-app cycle-navigator-dashboard`
- **Access:** `http://localhost:8501`

---

## 2025-11-26 — Risk Metrics & Playwright Test Update

**Summary**
- Implemented Annualized Volatility and Sharpe Ratio calculations and displayed them in the Streamlit dashboard.
- Added dynamic fetching of the 10-Year Treasury yield (used as risk-free rate) from yfinance (`^TNX`).
- Fixed bugs related to ambiguous pandas Series evaluation and ensured scalar outputs for metrics.
- Updated Playwright test to support headless/headful execution and verified the dashboard UI end-to-end.

**Files Changed**
- `stock_dashboard.py`:
  - Added `import numpy as np`.
  - Added `fetch_risk_free_rate()` to fetch the 10Y Treasury yield via yfinance (fallback to 4% if unavailable).
  - Added `calculate_risk_metrics(data, risk_free_rate=0.04)` which:
    - Computes daily returns from `Close` prices.
    - Computes annualized volatility = std(daily returns) * sqrt(252).
    - Computes annualized return = mean(daily returns) * 252.
    - Computes Sharpe ratio = (annualized return - risk_free_rate) / volatility.
    - Handles edge cases (insufficient data, NaNs, zero volatility) and coerces `Close` to numeric.
  - Displayed risk metrics in the dashboard under a new **Risk Profile** section with three metrics:
    - `Volatility (Ann.)` — formatted as percentage.
    - `Sharpe Ratio` — decimal.
    - `Risk-Free Rate (10Y)` — percentage used in the calculation.
  - Fixed handling when `data['Close']` might be a DataFrame (squeezed to a Series before numeric conversion).

- `scripts/playwright/test_dashboard.py`:
  - Made Playwright browser launch respect `PLAYWRIGHT_HEADLESS` env var (true/false/1/0/yes/no).
  - Kept existing UI interactions (click Update, select indicators) and saving screenshots to `artifacts/`.

- `requirements.txt`:
  - `numpy` is already present (`numpy==2.3.5`), no change needed.

**What I ran / How I tested**
- Started Streamlit server (background):

```bash
# start server (example used with venv)
/home/chuck/Projects/cycle-navigator-dashboard/venv/bin/streamlit run stock_dashboard.py --server.port 8501 &
```

- Verified server reachable:

```bash
curl -I http://localhost:8501
```

- Run Playwright tests (headless):

```bash
env PLAYWRIGHT_HEADLESS=true /home/chuck/Projects/cycle-navigator-dashboard/venv/bin/python scripts/playwright/test_dashboard.py
```

- Run Playwright tests (headful — opens visible browser):

```bash
env PLAYWRIGHT_HEADLESS=false /home/chuck/Projects/cycle-navigator-dashboard/venv/bin/python scripts/playwright/test_dashboard.py
```

- Results from the run in this session:
  - Playwright headless test passed: 11/11 checks.
  - Screenshots saved:
    - `artifacts/initial.png`
    - `artifacts/after_update.png`
    - `artifacts/after_indicators.png`
  - When Streamlit was started with `nohup`, a PID was printed in the session (example: `142244`). Use `ps` to check the actual PID on your system.

**Notes / Edge Cases**
- The Sharpe ratio calculation uses a simple annualization (252 trading days). If you prefer a different convention (calendar days, log returns), update `calculate_risk_metrics` accordingly.
- `fetch_risk_free_rate()` uses the `^TNX` ticker via yfinance which reports yield in percent (e.g., `4.25` means 4.25%). The function converts to decimal (0.0425). If you have a preferred data source (FRED), we can switch to that.
- For very short time periods (e.g., `1d` with 1m bars), the daily-return approach may be noisy or not meaningful; the function returns `N/A` when insufficient data is present.

**Suggested Next Steps**
- Commit the changes to git and push to a feature branch (suggested branch name: `feature/risk-metrics`).
- Add unit tests for `calculate_risk_metrics` covering:
  - Typical multiday price series.
  - Constant price series (volatility=0 -> sharpe `NaN` or handled).
  - Small datasets (<2 rows) returning `NaN`.
- Consider adding configurable annualization days (default 252) via a UI control or config.
- Add a small integration test to assert that the `Risk Profile` metrics appear on the page after clicking `Update`.

**Change Log (concise)**
- Implemented risk metrics + risk-free fetch — `stock_dashboard.py`.
- Fixed pandas Series ambiguity and coercion issues — `stock_dashboard.py`.
- Playwright headless flag added — `scripts/playwright/test_dashboard.py`.
- Verified UI with Playwright; screenshots in `artifacts/`.

---

*This CHANGELOG entry was created automatically from `documents/RISK_METRICS_UPDATE.md`.*

## 2025-12-09 — CI: E2E workflow Playwright fix

**Summary**
- Fixed E2E workflow failure due to missing Playwright Python package in the runner environment.
- Updated `.github/workflows/e2e.yml` to install `requirements-dev.txt` (which includes `playwright`) before running `python -m playwright install` and starting tests.
- Verified successful E2E run in CI: Playwright tests ran against the built container and passed.

**Files Changed**
- `.github/workflows/e2e.yml`: Install dev requirements before `playwright install`.

