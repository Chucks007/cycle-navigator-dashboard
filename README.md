# Cycle Navigator Dashboard

A real-time financial analytics dashboard for monitoring macro liquidity, crypto dominance, and implementing barbell portfolio strategies.

Built with **Next.js 15**, **FastAPI**, **TimescaleDB**, and **Redis**.

---

## 🚀 Quick Start

Get the dashboard running in under 5 minutes with Docker/Podman Compose.

### 1. Configure Environment

```bash
# Clone repository
git clone https://github.com/your-org/cycle-navigator-dashboard.git
cd cycle-navigator-dashboard

# Copy environment template
cp .env.example .env

# Edit .env and add your API keys:
# - FRED_API_KEY (get from: https://fred.stlouisfed.org/docs/api/api_key.html)
# - COINGECKO_API_KEY (get from: https://www.coingecko.com/en/api)
```

### 2. Start Services

**Using Podman Compose (Recommended):**

```bash
podman-compose up --build -d
```

**Using Docker Compose:**

```bash
docker-compose up --build -d
```

### 3. Initialize Database

```bash
# Podman
podman-compose exec backend python scripts/init_db.py

# Docker
docker-compose exec backend python scripts/init_db.py
```

### 4. Access Dashboard

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 15)                    │
│          React Server Components + TanStack Query           │
│                  ShadcN UI + Recharts                        │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Layer (FastAPI)                        │
│        /macro  /stocks  /crypto  /risk  /comparison         │
└──────┬─────────────────────┬────────────────────────────────┘
       │                     │
       │ Cache              │ Persistent
       ▼                    ▼
┌──────────────┐     ┌─────────────────────┐
│    Redis     │     │  PostgreSQL 16 +    │
│  (< 100ms)   │◄────┤   TimescaleDB       │
└──────────────┘     └──────┬──────────────┘
                            ▲
                            │ Background Workers
                            │
              ┌─────────────┴─────────────┐
              │   Celery + Redis Broker   │
              │  FRED (2AM) | Crypto (2:15AM) │
              └───────────────────────────┘
```

### Core Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 15, TypeScript, React 19 | Server-side rendering, client interactivity |
| **UI** | ShadcN UI, Tailwind CSS, Recharts | Accessible components, financial charts |
| **Backend** | FastAPI, Pydantic, Uvicorn | High-performance async Python API |
| **Database** | PostgreSQL 16 + TimescaleDB | Time-series data with hypertables |
| **Cache** | Redis 7 | Sub-100ms response times |
| **Workers** | Celery, Celery Beat | Scheduled data fetching (FRED, CoinGecko) |
| **Containers** | Podman/Docker Compose | Multi-container orchestration |

---

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

## ✨ Key Features

### 🏦 Macro Dashboard
- **M2 Money Supply** with CPI-adjusted purchasing power toggle
- **Federal Debt** tracking and debt-to-liquidity ratios
- **Real Interest Rates** (nominal - inflation)
- **Crypto Market Dominance** (BTC, ETH, OTHERS stacked visualization)

### 📊 Technical Analysis
- Real-time stock price charts
- Technical indicators (SMA, EMA, RSI, Bollinger Bands)
- Log-regression risk bands (planned)
- Custom timeframe selection

### ⚖️ Barbell Strategy
- Safe vs. Risk asset allocation tracking (planned)
- Portfolio volatility analysis
- Tail-risk coverage metrics

---

## 📚 Documentation

Comprehensive guides for developers and operators:

- **[Technical Architecture](documents/TECHNICAL_ARCHITECTURE.md)** - System design, database schema, worker architecture, performance benchmarks
- **[Feature Guide](documents/FEATURE_GUIDE.md)** - M2 purchasing power, crypto dominance, mathematical implementations
- **[Developer Setup](documents/DEVELOPER_SETUP.md)** - Local environment configuration, troubleshooting
- **[Deployment Guide](documents/DEPLOYMENT.md)** - CI/CD pipelines, container publishing, automated updates
- **[Verification Guide](documents/VERIFICATION.md)** - Testing procedures, health checks, E2E tests

---

## 🔧 Development

### Local Setup (No Containers)

See [Developer Setup](documents/DEVELOPER_SETUP.md) for detailed instructions.

**Quick start:**

```bash
# Backend
python -m venv .venv
source .venv/bin/activate  # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
uvicorn backend.main:app --reload

# Frontend
cd web
npm install
npm run dev
```

### Running Tests

```bash
# Backend unit tests
pytest

# Frontend unit tests
cd web && npm test

# E2E tests (Playwright)
python -m playwright install chromium
python scripts/playwright/test_dashboard.py
```

---

## 🚢 Deployment

### CI/CD Pipeline

GitHub Actions workflows automatically:
- Lint code (Ruff, ESLint)
- Run tests (pytest, Playwright)
- Build container images
- Publish to GitHub Container Registry (GHCR)

### Automated Updates (Watchtower)

Set up Watchtower to auto-deploy new images:

```bash
docker run -d --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e WATCHTOWER_POLL_INTERVAL=300 \
  containrrr/watchtower \
  cycle-navigator-backend cycle-navigator-web
```

See [Deployment Guide](documents/DEPLOYMENT.md) for production deployment procedures.

---

## 🐛 Troubleshooting

**Charts showing "Error Loading Data"?**
1. Check backend health: `curl http://localhost:8000/health`
2. Initialize database: `docker-compose exec backend python scripts/init_db.py`
3. Check logs: `docker-compose logs -f backend`

**API returning empty arrays?**
1. Verify API keys in `.env`: `FRED_API_KEY`, `COINGECKO_API_KEY`
2. Check worker status: `docker-compose logs celery-worker`
3. Manually trigger data fetch: `docker-compose exec backend celery -A backend.celery_app call backend.tasks.fred_tasks.update_all_fred_series`

**Frontend showing "Backend Offline"?**
1. Verify `NEXT_PUBLIC_API_URL` is set at build time
2. Rebuild frontend: `docker-compose build --no-cache web`
3. Check [Verification Guide](documents/VERIFICATION.md) for detailed troubleshooting

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

Contributions welcome! Please:
1. Open an issue to discuss proposed changes
2. Fork the repository and create a feature branch
3. Include tests for new functionality
4. Follow existing code style (Ruff for Python, ESLint for TypeScript)
5. Submit a pull request

---

## 📧 Contact

For questions or support, open an issue on GitHub.

**Project Maintainer**: [@your-username](https://github.com/your-username)
