# CI / CD Summary for Cycle Navigator Dashboard

Date: 2025-12-09

This document records the CI/CD work performed for the Cycle Navigator Dashboard project. It captures decisions, implemented workflows, quick troubleshooting and how-tos so you can reference or onboard reviewers.

---

## Overview

Goal:
- Provide automated linting, unit testing, container builds, E2E Playwright tests (manual/scheduled) and automated container publishing to GHCR.
- Document local reproduction steps and provide guidance for managing secrets and Watchtower for auto-deployment.

Key outcomes:
- Implemented `ci.yml` for PR & push checks (lint, tests, build, verify) and `e2e.yml` for Playwright tests (manual / scheduled).
- Configured GHCR push step for container image publishing (SHA + `latest` tags).
- Added a Playwright E2E job that builds the same container, runs it, and verifies the UI.
- Fixed a CI runner issue where Playwright was missing by installing `requirements-dev.txt` in the E2E workflow.
- Created developer-facing docs and verification reports and committed changes to `main`.

---

## Workflow details

### `.github/workflows/ci.yml` (CI workflow):
- Triggers: `push` to `develop` and `pull_request`.
- Steps (high-level):
  1. Checkout repository
  2. Install Python 3.11
  3. Install dependencies from `requirements.txt`
  4. Run `ruff` linting
  5. Run unit tests with `pytest`
  6. Build Containerfile into an image
  7. Optionally push the image to GHCR (configured to push only from `develop`/`main`, or based on job conditions)
  8. Verify dependencies inside built container (quick smoke test)

Notes:
- `ruff` enforces code style and caught some early unused variable issues which were corrected.
- The container build step ensures we keep the CI build validated and repeatable.

### `.github/workflows/e2e.yml` (E2E Playwright workflow):
- Triggers: `workflow_dispatch` (manual) and optional cron schedule.
- Steps (high-level):
  1. Checkout repo
  2. Setup Python 3.11 locator
  3. Install dependencies
     - Important: We now `pip install -r requirements.txt -r requirements-dev.txt` so `playwright` (and dev tools) is present
  4. Install Playwright browsers: `python -m playwright install --with-deps chromium`
  5. Build container image with the same `Containerfile` used by CI
  6. Start the container (expose ports: backend 8000, streamlit 8501)
  7. Use a readiness loop to check health endpoints
  8. Run `scripts/playwright/test_dashboard.py` with `PLAYWRIGHT_HEADLESS=true`
  9. Upload failure artifacts (screenshots, traces, logs) if the job failed
  10. Stop & remove the container

Why we changed e2e install step:
- The initial E2E run failed because `python -m playwright install` failed with "No module named playwright". That was because `playwright` (Python package) lived in `requirements-dev.txt` (dev dependencies) and the E2E job installed only `requirements.txt`.
- Fix: For E2E job, we now install both `requirements.txt` and `requirements-dev.txt` before running the Playwright browser installation command.

---

## Containerization & GHCR

- Container file: `Containerfile` (based on `python:3.11-slim`) builds image for both frontend and backend.
- Build and verification steps are part of the CI job; the E2E uses the same container build for integration test parity.
- GHCR Push: CI `ci.yml` is configured to authenticate against GHCR and push images using `docker/build-push-action` if configured to do so (e.g., from `develop` / `main` or on successful PR).
- Image tags:
  - `ghcr.io/<owner>/cycle-navigator-dashboard:<SHA>` — unique per commit (recommended)
  - `ghcr.io/<owner>/cycle-navigator-dashboard:latest` — on `develop`/`main`

---

## Watchtower / Local Auto-Deploy

- We documented setup in `documents/WATCHTOWER_SETUP.md`.
- Watchtower or an equivalent Podman auto-update tool can watch GHCR and pull+restart the container automatically when a new image arrives.
- Use `podman run` / `docker run` commands shown in `WATCHTOWER_SETUP.md` to configure local auto-updates with proper credentials.

---

## Testing & Lint

- `pytest` unit tests implemented: 33 tests (local run: `pytest` 33 passed).
- `ruff` linting enforced in CI; configuration in `pyproject.toml`.
- Playwright: tests added in `scripts/playwright/test_dashboard.py` which captures screenshots to `artifacts/` and validates UI elements.

---

## Troubleshooting & Repro Instructions

- Running Playwright locally (recommended development sequence):
  ```fish
  python -m pip install --upgrade pip
  pip install -r requirements.txt -r requirements-dev.txt
  python -m playwright install chromium
  python scripts/playwright/test_dashboard.py
  ```

- If Playwright reports missing `playwright` module: ensure `requirements-dev.txt` has `playwright` and is installed (see above).
- If Playwright reports missing browsers: run `python -m playwright install chromium` (or `python -m playwright install` to install all browsers).
- If `page.goto` shows `ERR_SOCKET_NOT_CONNECTED` or connection refused: ensure the app is running (use `./start.sh` or run the container) and ports align: backend: 8000, streamlit: 8501.
- `pip install` caching: Consider using pip cache action to speed up installs in CI.

---

## Security & Secrets

- `FRED_API_KEY` and any other secrets must be stored in GitHub Secrets (Settings -> Security -> Secrets). The E2E workflow consumes `FRED_API_KEY` to start the container.
- Ensure that the repository permissions and workflows are allowed to reference secrets and have the `read`/`write` package permissions where necessary for GHCR publishing.
- Avoid committing secrets to the repo; use environment variables and CI secrets for API keys.

---

## Artifacts & Debugging

- Playwright artifacts (screenshots, traces) are saved to `artifacts/` in the repo or uploaded as Actions artifacts for failed runs.
- If an E2E run fails: check the job logs (runner logs and any Playwright traces) and download screenshots to see the state when the test failed. The E2E job is configured to upload these automatically on failures.

---

## Recent Events & Notable Fixes

- 2025-12-09: E2E workflow initially failed with "No module named playwright" (run id `20076352882`). Root cause: runner installed only `requirements.txt` (not dev requirements).
- 2025-12-09: Fixed e2e workflow by installing `requirements-dev.txt` in the E2E job. Re-run succeeded (run id `20076497322`).
- Documentation updates: `README.md`, `documents/to_do_CI_CD.md`, `documents/VERIFICATION_REPORT.md`, and `documents/CHANGELOG.md` were updated to reflect the changes.

---

## Next Steps / Recommendations

- Add CI workflow status badges to the `README.md` (for both `ci.yml` and `e2e.yml`).
- Add notifications to the CI pipeline (Slack, email, or other) for job failure alerts.
- Add automatic `vX.Y.Z` tagging upon merges and a release procedure.
- Improve caching for pip in CI to speed up runs (actions/cache; pip cache directories) and consider using `pipx` for tools like `ruff` if desired.
- Add additional integration tests to cover backend endpoints and more Playwright scenarios (e.g., different tickers, errors, network failures).
- Update `documents/VERIFICATION_REPORT.md` with long-term trends and a table for recorded E2E runs for the latest `main` / `develop`.

---

## Files of interest (recently modified)

- `.github/workflows/ci.yml` (CI job)
- `.github/workflows/e2e.yml` (Playwright E2E)
- `requirements.dev.txt` (dev & test dependencies)
- `requirements.txt` (runtime dependencies)
- `Containerfile` (image build recipe)
- `start.sh` (start script for container)
- `scripts/playwright/test_dashboard.py` (Playwright E2E script)
- `documents/WATCHTOWER_SETUP.md` (Watchtower config doc)

---

If you want, I can also:
- Add CI badges to README
- Add Slack/email/issue notification steps
- Add release tagging automation
- Add an 'E2E health' daily cron and status-hosting

---

This file was generated automatically from the recent commits and workflow edits; commit and PR history in the repository provides commit-level detail if you need to dig deeper.