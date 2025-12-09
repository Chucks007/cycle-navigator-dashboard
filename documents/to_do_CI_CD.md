# CI/CD To-Do List for Cycle Navigator Dashboard

This document outlines the next steps for establishing a robust Continuous Integration (CI) and Continuous Delivery (CD) pipeline for the Cycle Navigator Dashboard application.

## 1. Continuous Integration (CI) Setup

The goal of CI is to automate the building and testing of the application with every code change, ensuring quality and detecting issues early.

-   [x] **Create Basic GitHub Actions Workflow (`.github/workflows/ci.yml`)**
    -   Trigger on `push` to `develop` and `pull_request` events.
    -   Define a job that runs on `ubuntu-latest`, installs deps, lints with `ruff`, runs `pytest`, and builds the `Containerfile` image.
    -   Playwright E2E tests still run outside this workflow (see the Playwright section for the manual/scheduled job).

-   [x] **Integrate Linting**
    -   [x] Added `ruff` linting step in the CI workflow that runs after installing dependencies and before tests.
    -   [x] Configured linting rules in `pyproject.toml` under `[tool.ruff]` targeting `backend`, `scripts`, and top-level Python files while excluding generated folders (`__pycache__`, `artifacts`, `venv`).
    -   [x] Created `requirements-dev.txt` with `ruff` and `pytest` for consistent dev/CI environments.

-   [ ] **Implement Unit & Integration Tests**
    -   [ ] **Write Tests:** Develop unit tests for key functions, particularly in `backend/services.py` and `stock_dashboard.py`.
    -   [ ] **Integrate Pytest:** Add a step in the CI workflow to run `pytest` (or your chosen test runner) to execute these tests.

-   [ ] **Automate Container Image Build**
    -   [ ] Add a step in the CI workflow to build the `cycle-navigator-dashboard` Podman/Docker image using the `Containerfile`.
    -   [ ] Ensure the build process verifies dependency installation.

-   [x] **Automate UI Testing with Playwright**
    -   [x] **Run Playwright manually / separate workflow**: A `workflow_dispatch`/scheduled job now runs the test suite without blocking PR CI.
    -   [x] Create a separate `.github/workflows/e2e.yml` triggered by `workflow_dispatch` (and an optional nightly cron) that installs browsers and runs the script headless.
    -   [x] The E2E workflow builds the same container, starts it, waits for health/readiness endpoints, runs `scripts/playwright/test_dashboard.py` with `PLAYWRIGHT_HEADLESS=true`, and tears down the container.
    -   [x] The E2E workflow uploads failure artifacts (screenshots/traces/logs) for easier debugging.

## 2. Continuous Delivery (CD) Setup

The goal of CD is to automate the release process, making it easy to deploy new versions of the application.

-   [ ] **Set up GitHub Container Registry (GHCR)**
    -   [ ] Configure GitHub Actions to authenticate with GHCR.
    -   [ ] Add a step in the CI workflow (after successful build and tests) to push the `cycle-navigator-dashboard` image to GHCR, tagging it appropriately (e.g., with `latest` and `git_sha`).

-   [ ] **Automate Local Deployment (using Watchtower or similar)**
    -   [ ] Research and understand how Watchtower (or a similar tool) can monitor GHCR for new `cycle-navigator-dashboard` images.
    -   [ ] Document instructions for setting up Watchtower on the local machine to automatically pull and restart the application container.
+
## 3. General Best Practices

-   [ ] **Notifications:** Configure CI/CD pipeline notifications for failures (e.g., via GitHub Actions checks, email, Slack).
-   [ ] **Secrets Management:** Ensure any API keys or sensitive information are handled securely within the CI/CD environment (e.g., GitHub Secrets).
-   [ ] **Version Tagging:** Integrate automatic Git tagging (e.g., `vX.Y.Z`) upon merges to `main` for releases.
