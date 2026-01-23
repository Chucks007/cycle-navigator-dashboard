---
name: git-workflow
description: Standards for committing and pushing code to the Cycle Navigator Dashboard repository. Use this when the user wants to save, commit, or deploy changes.
---

# Git Workflow Instructions

When performing a commit or preparing a push, follow these project-specific rules:

1. **Pre-Commit Verification**:
   - Ensure the backend passes linting: `ruff check backend/`.
   - If frontend changes were made, run: `npm run lint` in the `web` directory.
   - Verify that all containers are healthy if running locally: `podman-compose ps`.

2. **Commit Message Format**:
   - Use descriptive headers (e.g., `feat:`, `fix:`, `docs:`, `refactor:`).
   - Mention specific components affected (e.g., `backend/tasks` or `web/components`).

3. **Breaking Changes**:
   - If the commit involves changing Celery module paths (e.g., from `services.macro_worker` to `celery_app`), explicitly note it as a "BREAKING CHANGE" in the commit body.
   - Remind the user to update `docker-compose.yml` if paths changed.

4. **Safety Checks**:
   - Never commit `.env` files or sensitive API keys (FRED_API_KEY, COINGECKO_API_KEY).
   - Verify that any new database migrations are included in `scripts/timescale_migrations.sql`.