# Task 013: Repository Cleanup

**Status**: Pending
**Priority**: Low
**Created**: 2026-01-29

## Context
The project root directory contains loose files that clutter the workspace and do not adhere to the project structure. Additionally, there may be empty directories from previous refactors.

## Objective
Organize loose files and remove unused directories.

## Action Items

1.  **Move Files**:
    *   `Example.png` -> Move to `web/public/Example.png` (or delete if unused, but assuming it's an asset).
    *   `test-validation.js` -> Move to `scripts/test-validation.js`.

2.  **Remove Empty Directories**:
    *   Check `backend/scripts`. If empty, delete it.

3.  **Update References**:
    *   If `test-validation.js` is run via a package script or CI pipeline, update the path in `package.json` or `requirements.txt` / CI config accordingly.

## Verification
*   Root directory should be clean of `.png` and `.js` files (except config files).
*   Project builds and tests still run correctly.
