# Deployment Guide

This document covers production deployment procedures for the Cycle Navigator Dashboard, including CI/CD pipelines, container publishing, automated updates, and rollback strategies.

## Table of Contents

- [CI/CD Pipeline](#cicd-pipeline)
- [Container Publishing (GHCR)](#container-publishing-ghcr)
- [Automated Updates (Watchtower)](#automated-updates-watchtower)
- [Production Deployment Checklist](#production-deployment-checklist)
- [Rollback Procedures](#rollback-procedures)
- [Monitoring & Logging](#monitoring--logging)

---

## CI/CD Pipeline

### GitHub Actions Workflows

The project uses two primary GitHub Actions workflows:

#### 1. CI Workflow (`.github/workflows/ci.yml`)

**Triggers:**
- Push to `develop` or `main` branches
- Pull requests targeting `develop` or `main`

**Jobs:**

```yaml
jobs:
  lint-and-test:
    - Checkout repository
    - Setup Python 3.11
    - Install dependencies (requirements.txt)
    - Run Ruff linting (code style enforcement)
    - Run pytest (unit tests - 33+ tests)
    
  build-and-publish:
    - Build container images (backend + web)
    - Tag images with commit SHA + "latest"
    - Push to GitHub Container Registry (GHCR)
    - Verify dependencies inside built containers
```

**Environment Secrets Required:**
- `FRED_API_KEY` - Federal Reserve API key
- `COINGECKO_API_KEY` - CoinGecko API key
- `GITHUB_TOKEN` - Auto-provided (for GHCR publishing)

**Container Images Published:**
- `ghcr.io/<owner>/cycle-navigator-backend:<sha>`
- `ghcr.io/<owner>/cycle-navigator-backend:latest`
- `ghcr.io/<owner>/cycle-navigator-web:<sha>`
- `ghcr.io/<owner>/cycle-navigator-web:latest`

#### 2. E2E Workflow (`.github/workflows/e2e.yml`)

**Triggers:**
- Manual dispatch (`workflow_dispatch`)
- Optional: Scheduled cron (e.g., daily at midnight)

**Jobs:**

```yaml
jobs:
  e2e-tests:
    - Checkout repository
    - Setup Python 3.11
    - Install dependencies (requirements.txt + requirements-dev.txt)
    - Install Playwright browsers (chromium)
    - Build container images
    - Start containers (backend + web)
    - Wait for health checks to pass
    - Run Playwright E2E tests (scripts/playwright/test_dashboard.py)
    - Upload failure artifacts (screenshots, traces, logs)
    - Cleanup containers
```

**Why Two Dependency Files?**
- **requirements.txt**: Production dependencies (FastAPI, Celery, etc.)
- **requirements-dev.txt**: Development dependencies (pytest, Playwright, Ruff)
- E2E workflow needs both to run Playwright tests

**Critical Fix (2025-01-10):**
- Initial E2E runs failed with "No module named playwright"
- Fixed by installing `requirements-dev.txt` in E2E job
- Lesson: Always install dev dependencies for test runners

### Setting Up GitHub Secrets

1. Navigate to **Repository → Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Add required secrets:

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `FRED_API_KEY` | Federal Reserve Economic Data API | [https://fred.stlouisfed.org/docs/api/api_key.html](https://fred.stlouisfed.org/docs/api/api_key.html) |
| `COINGECKO_API_KEY` | CoinGecko cryptocurrency data API | [https://www.coingecko.com/en/api](https://www.coingecko.com/en/api) |

**Note:** `GITHUB_TOKEN` is automatically provided and doesn't need manual configuration.

### Workflow Status Badges

Add badges to README.md to display CI status:

```markdown
![CI](https://github.com/<owner>/<repo>/actions/workflows/ci.yml/badge.svg)
![E2E Tests](https://github.com/<owner>/<repo>/actions/workflows/e2e.yml/badge.svg)
```

---

## Container Publishing (GHCR)

### GitHub Container Registry Setup

**Authentication:**

```bash
# Create Personal Access Token (PAT) with scopes:
# - read:packages
# - write:packages
# - delete:packages (optional)

# Login to GHCR
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

**For Podman:**

```bash
echo "YOUR_GITHUB_PAT" | podman login ghcr.io -u YOUR_USERNAME --password-stdin
```

### Image Tagging Strategy

**Commit SHA Tags** (Recommended for Production):
```
ghcr.io/<owner>/cycle-navigator-backend:a1b2c3d
ghcr.io/<owner>/cycle-navigator-web:a1b2c3d
```

**Latest Tag** (For Development/Testing):
```
ghcr.io/<owner>/cycle-navigator-backend:latest
ghcr.io/<owner>/cycle-navigator-web:latest
```

**Why Use SHA Tags in Production?**
- **Immutability**: SHA tags never change, ensuring reproducible deployments
- **Rollback**: Easy to identify and revert to specific versions
- **Audit Trail**: Git commit history matches deployed versions

### Manual Container Build & Push

**Build:**

```bash
# Backend
docker build -f docker/backend.Dockerfile -t ghcr.io/<owner>/cycle-navigator-backend:$(git rev-parse --short HEAD) .

# Web
docker build -f web/Dockerfile -t ghcr.io/<owner>/cycle-navigator-web:$(git rev-parse --short HEAD) ./web
```

**Push:**

```bash
# Backend
docker push ghcr.io/<owner>/cycle-navigator-backend:$(git rev-parse --short HEAD)

# Web
docker push ghcr.io/<owner>/cycle-navigator-web:$(git rev-parse --short HEAD)
```

**Tag as Latest:**

```bash
docker tag ghcr.io/<owner>/cycle-navigator-backend:$(git rev-parse --short HEAD) ghcr.io/<owner>/cycle-navigator-backend:latest
docker push ghcr.io/<owner>/cycle-navigator-backend:latest
```

### Pull Published Images

```bash
# Pull specific version
docker pull ghcr.io/<owner>/cycle-navigator-backend:a1b2c3d

# Pull latest
docker pull ghcr.io/<owner>/cycle-navigator-backend:latest

# Update docker-compose.yml to use GHCR images
docker-compose pull
docker-compose up -d
```

---

## Automated Updates (Watchtower)

### Watchtower Overview

**Watchtower** monitors running containers and automatically:
1. Checks for updated images in the registry (every 5 minutes by default)
2. Pulls new images when available
3. Gracefully stops and restarts containers with the new image

**Deployment Workflow:**
```
Developer pushes to develop
  ↓
GitHub Actions CI builds & tests
  ↓
CI pushes images to GHCR
  ↓
Watchtower detects new images (polls every 5 min)
  ↓
Watchtower pulls and restarts containers
  ↓
Application auto-deploys with zero manual intervention
```

### Watchtower Setup (Docker)

```bash
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ~/.docker/config.json:/config.json:ro \
  -e WATCHTOWER_POLL_INTERVAL=300 \
  -e WATCHTOWER_CLEANUP=true \
  -e WATCHTOWER_INCLUDE_STOPPED=false \
  --restart unless-stopped \
  containrrr/watchtower \
  cycle-navigator-backend cycle-navigator-web
```

**Configuration:**
- `WATCHTOWER_POLL_INTERVAL=300`: Check for updates every 5 minutes (300 seconds)
- `WATCHTOWER_CLEANUP=true`: Remove old images after successful update
- Container names: `cycle-navigator-backend cycle-navigator-web` (only monitor these)

### Watchtower Setup (Podman)

```bash
# Enable Podman socket (if not already running)
systemctl --user enable --now podman.socket

# Run Watchtower
podman run -d \
  --name watchtower \
  -v /run/user/$(id -u)/podman/podman.sock:/var/run/docker.sock \
  -v ~/.config/containers/auth.json:/config.json:ro \
  -e WATCHTOWER_POLL_INTERVAL=300 \
  -e WATCHTOWER_CLEANUP=true \
  --restart unless-stopped \
  docker.io/containrrr/watchtower \
  cycle-navigator-backend cycle-navigator-web
```

### Podman Native Auto-Update

Podman has built-in auto-update functionality:

```bash
# Run containers with auto-update label
podman run -d \
  --name cycle-navigator-backend \
  --label io.containers.autoupdate=registry \
  -p 8000:8000 \
  ghcr.io/<owner>/cycle-navigator-backend:latest

# Enable systemd timer for auto-updates
systemctl --user enable --now podman-auto-update.timer

# Manually trigger update check
podman auto-update
```

**Auto-update schedule:** Daily by default (controlled by systemd timer)

### Monitoring Watchtower

**View logs:**

```bash
# Docker
docker logs -f watchtower

# Podman
podman logs -f watchtower
```

**Sample log output:**

```
time="2026-01-21T10:00:00Z" level=info msg="Watchtower 1.7.1"
time="2026-01-21T10:00:00Z" level=info msg="Checking for updates..."
time="2026-01-21T10:05:00Z" level=info msg="Found new image for cycle-navigator-backend"
time="2026-01-21T10:05:30Z" level=info msg="Stopping container cycle-navigator-backend (signal: SIGTERM)"
time="2026-01-21T10:05:35Z" level=info msg="Updating container cycle-navigator-backend"
time="2026-01-21T10:05:40Z" level=info msg="Successfully restarted cycle-navigator-backend"
```

---

## Production Deployment Checklist

### Pre-Deployment

- [ ] **Back up production database**
  ```bash
  pg_dump -h <host> -U cycle_user cycle_navigator > backup_$(date +%Y%m%d_%H%M%S).sql
  ```

- [ ] **Review recent commits**
  ```bash
  git log --oneline -10
  ```

- [ ] **Test on staging environment**
  - Deploy to staging first
  - Run E2E tests: `python scripts/playwright/test_dashboard.py`
  - Verify all charts load correctly
  - Check API health: `curl http://staging:8000/health`

- [ ] **Verify CI/CD pipeline passed**
  - All lint checks passed
  - All unit tests passed (33+)
  - E2E tests passed (if triggered)
  - Container builds successful

- [ ] **Check breaking changes**
  - Review [CHANGELOG.md](CHANGELOG.md) for migration notes
  - Check for database schema changes
  - Review [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) for API changes

### Deployment Steps

**1. Pull Latest Images:**

```bash
# Docker Compose
docker-compose pull

# Manual
docker pull ghcr.io/<owner>/cycle-navigator-backend:latest
docker pull ghcr.io/<owner>/cycle-navigator-web:latest
```

**2. Run Database Migrations (if needed):**

```bash
# Check migration prerequisites
docker-compose exec backend python scripts/run_timescale_migrations.py --check-only

# Preview migration SQL
docker-compose exec backend python scripts/run_timescale_migrations.py --dry-run

# Run migration (during maintenance window)
docker-compose exec backend python scripts/run_timescale_migrations.py
```

**3. Update Containers:**

```bash
# Docker Compose
docker-compose down
docker-compose up -d

# Or with zero-downtime (requires load balancer)
docker-compose up -d --no-deps --build backend
docker-compose up -d --no-deps --build web
```

**4. Verify Health:**

```bash
# Check container status
docker-compose ps

# Test health endpoints
curl http://localhost:8000/health
curl http://localhost:3000

# Check logs
docker-compose logs -f backend
docker-compose logs -f web
docker-compose logs -f celery-worker
```

### Post-Deployment

- [ ] **Monitor application logs**
  ```bash
  docker-compose logs -f | grep ERROR
  ```

- [ ] **Check Celery worker status**
  ```bash
  docker-compose exec backend celery -A backend.celery_app inspect active
  ```

- [ ] **Verify data freshness**
  ```sql
  SELECT series_id, last_fetched, fetch_status 
  FROM fred_series_metadata 
  ORDER BY last_fetched DESC;
  ```

- [ ] **Test critical user flows**
  - Load macro dashboard
  - Expand liquidity chart
  - Toggle CPI adjustment
  - Search for a stock ticker
  - View crypto dominance chart

- [ ] **Monitor query performance**
  ```sql
  SELECT * FROM pg_stat_statements 
  ORDER BY mean_exec_time DESC 
  LIMIT 10;
  ```

### Rollback Trigger Conditions

Initiate rollback if:
- **Error rate > 5%** in application logs
- **API response time > 2 seconds** (baseline: <100ms)
- **Database connection errors**
- **Celery worker crashes repeatedly**
- **Critical feature broken** (e.g., charts not loading)

---

## Rollback Procedures

### Quick Rollback (Container Level)

**Option 1: Revert to Previous Image Tag**

```bash
# Identify previous working SHA
git log --oneline -10

# Update docker-compose.yml or pull specific tag
docker pull ghcr.io/<owner>/cycle-navigator-backend:previous-sha
docker tag ghcr.io/<owner>/cycle-navigator-backend:previous-sha ghcr.io/<owner>/cycle-navigator-backend:latest

# Restart containers
docker-compose down
docker-compose up -d
```

**Option 2: Use Docker Image History**

```bash
# List local images
docker images ghcr.io/<owner>/cycle-navigator-backend

# Retag previous image as latest
docker tag <previous-image-id> ghcr.io/<owner>/cycle-navigator-backend:latest

# Restart
docker-compose restart backend
```

### Database Rollback

**Restore from Backup:**

```bash
# Stop application
docker-compose down

# Restore database
psql -h <host> -U cycle_user cycle_navigator < backup_20260121_020000.sql

# Restart application
docker-compose up -d
```

**Note:** TimescaleDB hypertable conversion is **one-way**. Rollback requires restoring from pre-migration backup.

### Celery Task Rollback

**Revert Celery Module Path:**

```yaml
# docker-compose.yml
celery-worker:
  command: celery -A backend.services.macro_worker worker --loglevel=info  # Old path

# Instead of:
# command: celery -A backend.celery_app worker --loglevel=info  # New path
```

**Restart worker:**

```bash
docker-compose restart celery-worker celery-beat
```

### Emergency Hotfix Deployment

**Bypass CI/CD for Critical Fixes:**

```bash
# 1. Make hotfix locally
git checkout -b hotfix/critical-bug-fix

# 2. Build image locally
docker build -f docker/backend.Dockerfile -t ghcr.io/<owner>/cycle-navigator-backend:hotfix .

# 3. Push to GHCR
docker push ghcr.io/<owner>/cycle-navigator-backend:hotfix

# 4. Deploy immediately
docker pull ghcr.io/<owner>/cycle-navigator-backend:hotfix
docker tag ghcr.io/<owner>/cycle-navigator-backend:hotfix ghcr.io/<owner>/cycle-navigator-backend:latest
docker-compose restart backend

# 5. Create PR and merge to main after verification
git push origin hotfix/critical-bug-fix
```

---

## Monitoring & Logging

### Application Logs

**Real-time monitoring:**

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Filter by log level
docker-compose logs backend | grep ERROR
docker-compose logs backend | grep WARNING
```

**Persistent logging (production):**

```yaml
# docker-compose.yml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Health Check Monitoring

**Automated health checks:**

```yaml
# docker-compose.yml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 15s
      timeout: 10s
      retries: 3
      start_period: 40s
```

**Manual health verification:**

```bash
# Backend health
curl http://localhost:8000/health

# Database health
docker-compose exec postgres pg_isready -U cycle_user

# Redis health
docker-compose exec redis redis-cli ping

# Celery worker status
docker-compose exec backend celery -A backend.celery_app inspect ping
```

### Performance Monitoring

**Database query performance:**

```sql
-- Enable pg_stat_statements extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slow queries
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Redis monitoring:**

```bash
# Real-time commands
docker-compose exec redis redis-cli MONITOR

# Memory usage
docker-compose exec redis redis-cli INFO memory

# Cache hit rate
docker-compose exec redis redis-cli INFO stats | grep keyspace
```

### Alerting (Future Enhancement)

**Recommended Tools:**
- **Prometheus + Grafana**: Metrics collection and visualization
- **Sentry**: Error tracking and alerting
- **PagerDuty**: On-call incident management
- **Uptime Robot**: External uptime monitoring

**Sample alert conditions:**
- API response time > 2 seconds for 5 minutes
- Error rate > 5% over 10 minutes
- Database connection pool exhaustion
- Celery worker offline for > 10 minutes
- Disk usage > 90%

---

## Related Documentation

- **[Technical Architecture](TECHNICAL_ARCHITECTURE.md)** - System design, worker architecture, performance benchmarks
- **[Developer Setup](DEVELOPER_SETUP.md)** - Local development environment configuration
- **[Feature Guide](FEATURE_GUIDE.md)** - Feature implementations and usage
- **[Verification Guide](VERIFICATION.md)** - Testing procedures and health checks

---

## Additional Resources

- **GitHub Actions Documentation**: [https://docs.github.com/en/actions](https://docs.github.com/en/actions)
- **Docker Compose Documentation**: [https://docs.docker.com/compose/](https://docs.docker.com/compose/)
- **Watchtower Documentation**: [https://containrrr.dev/watchtower/](https://containrrr.dev/watchtower/)
- **GHCR Documentation**: [https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
