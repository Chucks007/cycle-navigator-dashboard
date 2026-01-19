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

Next-generation headless dashboard for monitoring asset cycles, implementing Barbell Strategies, and tracking Macro Liquidity. Built with **Next.js 15 (React)**, **Tailwind CSS**, and **FastAPI**.

---

## Running with Docker Compose (Recommended)

The easiest and most reliable way to run this application is with Docker Compose. This method runs the backend (FastAPI) and frontend (Next.js) as separate containers.

**1. Configure Environment:**

Create a `.env` file in the root directory (see `.env.example`):

```bash
cp .env.example .env
# Edit .env and add your FRED_API_KEY
```

**2. Start Both Services:**

From the root of the repository, run:

```bash
docker-compose up --build
```

Or run in detached mode:

```bash
docker-compose up --build -d
```

**3. Access the Application:**

- **Web Frontend:** Open [http://localhost:3000](http://localhost:3000).
- **FastAPI Backend:** The API is available at [http://localhost:8000](http://localhost:8000).
  - Health Check: [http://localhost:8000/health](http://localhost:8000/health)
  - Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

**4. View Running Containers:**

```bash
docker ps
```

You should see: `cycle-navigator-backend` and `cycle-navigator-web`.

**5. Stopping the Services:**

```bash
docker-compose down

Recreate containers so Docker picks up changes:
docker compose down && docker compose up -d --build
```

### Using Podman Compose

If you use Podman:

```bash
podman-compose up --build

Recreate all: podman-compose down && podman-compose up -d --build
```

---

## Architecture & Project Structure

This project follows a Headless Architecture:

- **`web/`**: Next.js 15 App Router application with Tailwind CSS and Shadcn UI.
  - *Dockerized as `cycle-navigator-web`.*
- **`backend/`**: FastAPI python service handling financial data processing and API requests.
  - *Dockerized as `cycle-navigator-backend`.*
- **`scripts/`**: Utility scripts (`test_fred_api.py`, etc.).
- **`docker-compose.yml`**: Orchestrates the multi-container setup with internal networking.

**Key Features:**
- 🏰 **Macro Watchtower**: Track Global Liquidity (M2) and Real Rates.
- ⚖️ **Barbell Strategy**: Compare Hard Assets (Gold, BTC) vs Paper Assets (Stocks, Bonds).
- 🔍 **Ticker Analysis**: Real-time price charts and technical indicators.

<details>
<summary>Local Development (No Docker)</summary>

### Prerequisites
- Python 3.11+
- Node.js 20+

### 1. Start Backend
```bash
# Setup Python Environment
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run Server
uvicorn backend.main:app --reload --port 8000
```

### 2. Start Frontend
```bash
cd web
npm install
npm run dev
# Access at http://localhost:3000
```
</details>

Install system-level packages and create a virtual environment:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install --upgrade pip
```

### Installation

**For Production Use:**
```bash
pip install -r requirements.txt
```

**For Development (includes testing, linting, and all production dependencies):**
```bash
pip install -r requirements-dev.txt
```

### Running the Applications

Once your environment is set up, you can run the Streamlit frontend and FastAPI backend.

**Frontend:**

Run the Streamlit app from the repository root (from the activated venv):

```bash
streamlit run stock_dashboard.py
```

**Backend (Optional):**

Start the FastAPI server (from repo root, venv active):

```bash
uvicorn backend.main:app --reload --port 8000
```

### Running Tests

After installing development dependencies, run the test suite:

```bash
pytest
```

For Playwright E2E tests, first install browsers:
```bash
python -m playwright install
```

</details>

---

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

- Docker Compose issues: Ensure Docker (or Podman with podman-compose) is installed and running. Check service logs with `docker-compose logs backend` or `docker-compose logs frontend`.

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
