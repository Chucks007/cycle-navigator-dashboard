# Cache Keys Management

This document explains the centralized Redis cache key management system.

## Overview

All Redis cache keys in the application are managed through the `CacheKeys` class in `backend/cache_keys.py`. This ensures:

- **Consistency**: All keys follow the same naming patterns
- **Discoverability**: Easy to find all cache key usages
- **Maintainability**: Update key patterns in one place
- **Type Safety**: Methods return properly formatted keys
- **Documentation**: Each key type is documented

## Key Patterns

### Macro Economic Data

```python
from backend.cache_keys import CacheKeys

# FRED time series data
CacheKeys.macro_series("M2SL")           # → "macro:M2SL"
CacheKeys.macro_series("CPIAUCSL")       # → "macro:CPIAUCSL"

# Series metadata
CacheKeys.macro_metadata("M2SL")         # → "macro:meta:M2SL"
```

### Cryptocurrency Data

```python
# Global dominance data
CacheKeys.crypto_dominance()             # → "crypto:dominance"

# Top coins by market cap
CacheKeys.crypto_top_coins(100)          # → "crypto:top:100"

# Individual coin history
CacheKeys.crypto_coin_history("bitcoin", 365)  # → "crypto:history:bitcoin:365"
```

### Locks & Rate Limiting

```python
# Rate limit locks
CacheKeys.rate_limit_lock("fred_api")    # → "lock:rate_limit_lock:fred_api"

# Task execution locks
CacheKeys.task_lock("update_crypto")     # → "lock:task:update_crypto"
```

## Usage in Code

### Before (Old Pattern)

```python
# ❌ Old way - hardcoded strings, inconsistent patterns
cache_key = f"{config.REDIS_CACHE_PREFIX}{series_id}"
cache_key = f"{REDIS_CRYPTO_CACHE_PREFIX}dominance"
lock_key = f"{REDIS_CACHE_PREFIX}{lock_name}"
```

### After (New Pattern)

```python
# ✅ New way - centralized, consistent, documented
from backend.cache_keys import CacheKeys

cache_key = CacheKeys.macro_series(series_id)
cache_key = CacheKeys.crypto_dominance()
lock_key = CacheKeys.rate_limit_lock(lock_name)
```

## Cache Management

### CLI Tool

Use the `manage_cache.py` script for cache operations:

```bash
# List all cache keys
python scripts/manage_cache.py list

# List only macro keys
python scripts/manage_cache.py list macro

# Show Redis info
python scripts/manage_cache.py info

# Clear crypto cache
python scripts/manage_cache.py clear crypto
```

### Programmatic Access

```python
from backend.cache_keys import CacheKeys
from backend.tasks.common import get_redis_client

redis_client = get_redis_client()

# List all macro keys
macro_keys = CacheKeys.list_all_keys(redis_client, 'macro')

# Invalidate all crypto data
deleted_count = CacheKeys.invalidate_crypto_data(redis_client)

# Invalidate specific series
CacheKeys.invalidate_macro_series(redis_client, "M2SL")

# Get all keys matching pattern
pattern = CacheKeys.get_pattern_prefix('crypto')
deleted = CacheKeys.invalidate_pattern(redis_client, pattern)
```

## Adding New Key Types

When adding new cache key types:

1. Add a static method to `CacheKeys` class
2. Follow the naming pattern: `<category>:<identifier>`
3. Add docstring with example usage
4. Update this documentation

Example:

```python
@staticmethod
def new_data_type(identifier: str) -> str:
    """
    Cache key for new data type.
    
    Args:
        identifier: Unique identifier
        
    Returns:
        Redis key
        
    Example:
        >>> CacheKeys.new_data_type("example")
        'newtype:example'
    """
    return f"newtype:{identifier}"
```

## Migration Guide

If you're updating existing code:

1. Import `CacheKeys`:
   ```python
   from backend.cache_keys import CacheKeys
   ```

2. Replace hardcoded strings:
   ```python
   # Before
   cache_key = f"{REDIS_CACHE_PREFIX}{series_id}"
   
   # After
   cache_key = CacheKeys.macro_series(series_id)
   ```

3. Remove imports of `REDIS_CACHE_PREFIX` and `REDIS_CRYPTO_CACHE_PREFIX`

4. Test that cache operations still work correctly

## Backward Compatibility

The module provides backward-compatible aliases:

```python
from backend.cache_keys import REDIS_CACHE_PREFIX, REDIS_CRYPTO_CACHE_PREFIX

# These work but are deprecated
cache_key = f"{REDIS_CACHE_PREFIX}{series_id}"  # Still works
```

However, **prefer using `CacheKeys` methods** for new code.

## Key Naming Conventions

All keys follow this pattern:

```
<category>:<type>:<identifier>[:<parameters>]
```

Examples:
- `macro:M2SL` - Macro series data
- `macro:meta:M2SL` - Macro series metadata
- `crypto:dominance` - Crypto dominance data
- `crypto:history:bitcoin:365` - Bitcoin 365-day history
- `lock:rate_limit_lock:fred_api` - FRED API rate limit lock

## Benefits

### Before Centralization
- ❌ Keys scattered across codebase
- ❌ Inconsistent patterns (`:` vs no delimiter)
- ❌ Typos go unnoticed
- ❌ Hard to find all usages
- ❌ No documentation

### After Centralization
- ✅ Single source of truth
- ✅ Consistent patterns enforced
- ✅ IDE autocomplete support
- ✅ Easy to discover all key types
- ✅ Self-documenting code
- ✅ Cache management utilities included

## Related Documentation

- [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) - System architecture
- [scripts/README.md](../scripts/README.md) - Script documentation
- [REFACTORING_ROADMAP.md](REFACTORING_ROADMAP.md) - Implementation roadmap
