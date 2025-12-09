# CI/CD To-Do List for Cycle Navigator Dashboard

This document outlines the next steps for establishing a robust Continuous Integration (CI) and Continuous Delivery (CD) pipeline for the Cycle Navigator Dashboard application.

## 1. Continuous Integration (CI) Setup

The goal of CI is to automate the building and testing of the application with every code change, ensuring quality and detecting issues early.

-   [ ] **Create Basic GitHub Actions Workflow (`.github/workflows/ci.yml`)**
    -   Trigger on `push` to `develop` and `pull_request` events.
    -   Define a job to run on a suitable runner (e.g., `ubuntu-latest`).
    -   Note: Playwright E2E tests will not run in this default CI; see the Playwright section below for a separate manual/scheduled E2E workflow.

-   [ ] **Integrate Linting**
    -   [ ] Add a step in the CI workflow to run a Python linter (e.g., `ruff` or `flake8`).
    -   [ ] Configure linting rules (if not already done in the project).

-   [ ] **Implement Unit & Integration Tests**
    -   [ ] **Write Tests:** Develop unit tests for key functions, particularly in `backend/services.py` and `stock_dashboard.py`.
    -   [ ] **Integrate Pytest:** Add a step in the CI workflow to run `pytest` (or your chosen test runner) to execute these tests.

-   [ ] **Automate Container Image Build**
    -   [ ] Add a step in the CI workflow to build the `cycle-navigator-dashboard` Podman/Docker image using the `Containerfile`.
    -   [ ] Ensure the build process verifies dependency installation.

-   [ ] **Automate UI Testing with Playwright**
    -   [ ] **Run Playwright manually / separate workflow**: Do not run the full Playwright E2E suite on every PR. Run manually via `workflow_dispatch`, on a schedule, or as a separate job triggered on `push` to `develop`.
    -   [ ] Create a separate `.github/workflows/e2e.yml` triggered by `workflow_dispatch` or schedule.
    -   [ ] Ensure the E2E workflow installs Playwright browsers (`python -m playwright install`) before running tests.
    -   [ ] The E2E workflow should start the application (container or `start.sh`), wait for a health/readiness endpoint, run `scripts/playwright/test_dashboard.py` with `PLAYWRIGHT_HEADLESS=true`, then tear down the app.
    -   [ ] Capture screenshots, traces, or logs on failure and upload them as workflow artifacts to aid debugging.

## 2. Continuous Delivery (CD) Setup

The goal of CD is to automate the release process, making it easy to deploy new versions of the application.

-   [ ] **Set up GitHub Container Registry (GHCR)**
    -   [ ] Configure GitHub Actions to authenticate with GHCR.
    -   [ ] Add a step in the CI workflow (after successful build and tests) to push the `cycle-navigator-dashboard` image to GHCR, tagging it appropriately (e.g., with `latest` and `git_sha`).

-   [ ] **Automate Local Deployment (using Watchtower or similar)**
    -   [ ] Research and understand how Watchtower (or a similar tool) can monitor GHCR for new `cycle-navigator-dashboard` images.
    -   [ ] Document instructions for setting up Watchtower on the local machine to automatically pull and restart the application container.

## 3. General Best Practices

-   [ ] **Notifications:** Configure CI/CD pipeline notifications for failures (e.g., via GitHub Actions checks, email, Slack).
-   [ ] **Secrets Management:** Ensure any API keys or sensitive information are handled securely within the CI/CD environment (e.g., GitHub Secrets).
-   [ ] **Version Tagging:** Integrate automatic Git tagging (e.g., `vX.Y.Z`) upon merges to `main` for releases.
