# Task 009: Split Backend Models

**Status**: Pending
**Priority**: Low
**Created**: 2026-01-26

## Context
`backend/models.py` currently contains SQLAlchemy models for all domains (Macro/FRED, Crypto, Stocks/Comparison). While the file is not yet huge (~100-150 lines), mixing distinct domains in a single file is a pattern that leads to "God Files".

## Objective
Split the models into domain-specific modules.

## Implementation Plan

### 1. Create Package
Create `backend/models/` directory with an `__init__.py`.

### 2. Move Models
- Create `backend/models/macro.py` for `FREDSeriesData`, `FREDSeriesMetadata`.
- Create `backend/models/crypto.py` for `CryptoData`, `CryptoMetadata`.
- Create `backend/models/stocks.py` (if any exist).

### 3. Update Exports
In `backend/models/__init__.py`, import and re-export all models so existing imports elsewhere don't break (or update them if desired).

## Benefits
- **Organization**: Logical grouping of related code.
- **Scalability**: Easier to add new domains without bloating a single file.
