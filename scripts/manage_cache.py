#!/usr/bin/env python3
"""
Redis cache management utility.

Provides commands for inspecting and managing the Redis cache using
the centralized CacheKeys module.

Usage:
    python scripts/manage_cache.py list [category]
    python scripts/manage_cache.py clear <category>
    python scripts/manage_cache.py info
"""

import argparse
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import redis

from backend.cache_keys import CacheKeys
from backend.config import REDIS_URL


def get_redis_client():
    """Get Redis client connection."""
    try:
        client = redis.from_url(REDIS_URL, decode_responses=True)
        client.ping()
        return client
    except Exception as e:
        print(f"❌ Failed to connect to Redis: {e}")
        sys.exit(1)


def list_keys(category=None):
    """List all cache keys, optionally filtered by category."""
    client = get_redis_client()
    keys = CacheKeys.list_all_keys(client, category)
    
    if not keys:
        print(f"No keys found{f' in category: {category}' if category else ''}")
        return
    
    print(f"\n📋 Found {len(keys)} key{'' if len(keys) == 1 else 's'}{f' in category: {category}' if category else ''}:\n")
    
    # Group by prefix for better display
    by_prefix = {}
    for key in keys:
        prefix = key.split(':')[0]
        by_prefix.setdefault(prefix, []).append(key)
    
    for prefix in sorted(by_prefix.keys()):
        print(f"  {prefix}:")
        for key in sorted(by_prefix[prefix]):
            # Get TTL if available
            try:
                ttl = client.ttl(key)
                ttl_str = f" (TTL: {ttl}s)" if ttl > 0 else " (no expiry)" if ttl == -1 else ""
            except:
                ttl_str = ""
            
            print(f"    • {key}{ttl_str}")
        print()


def clear_cache(category):
    """Clear all keys in a category."""
    if category not in ['macro', 'crypto', 'lock', 'all']:
        print(f"❌ Invalid category: {category}")
        print("Valid categories: macro, crypto, lock, all")
        sys.exit(1)
    
    client = get_redis_client()
    
    if category == 'all':
        # Clear all cache keys (be careful!)
        response = input("⚠️  This will delete ALL cache keys. Are you sure? (yes/no): ")
        if response.lower() != 'yes':
            print("Cancelled.")
            return
        
        pattern = "*"
        deleted = CacheKeys.invalidate_pattern(client, pattern)
    else:
        pattern = CacheKeys.get_pattern_prefix(category)
        deleted = CacheKeys.invalidate_pattern(client, pattern)
    
    print(f"✅ Deleted {deleted} key{'' if deleted == 1 else 's'} matching pattern: {pattern}")


def show_info():
    """Show Redis connection info and statistics."""
    client = get_redis_client()
    
    try:
        info = client.info()
        
        print("\n📊 Redis Cache Information:\n")
        print(f"  Version: {info.get('redis_version', 'N/A')}")
        print(f"  Used Memory: {info.get('used_memory_human', 'N/A')}")
        print(f"  Connected Clients: {info.get('connected_clients', 'N/A')}")
        print(f"  Total Keys: {client.dbsize()}")
        print(f"  Uptime: {info.get('uptime_in_days', 'N/A')} days")
        print()
        
        # Count keys by category
        macro_keys = len(CacheKeys.list_all_keys(client, 'macro'))
        crypto_keys = len(CacheKeys.list_all_keys(client, 'crypto'))
        lock_keys = len(CacheKeys.list_all_keys(client, 'lock'))
        
        print("  Keys by Category:")
        print(f"    • macro: {macro_keys}")
        print(f"    • crypto: {crypto_keys}")
        print(f"    • lock: {lock_keys}")
        print()
        
    except Exception as e:
        print(f"❌ Failed to get Redis info: {e}")
        sys.exit(1)


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Manage Redis cache keys",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # List all cache keys
  python scripts/manage_cache.py list
  
  # List only macro keys
  python scripts/manage_cache.py list macro
  
  # Clear crypto cache
  python scripts/manage_cache.py clear crypto
  
  # Show Redis info
  python scripts/manage_cache.py info
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    
    # List command
    list_parser = subparsers.add_parser('list', help='List cache keys')
    list_parser.add_argument(
        'category',
        nargs='?',
        choices=['macro', 'crypto', 'lock'],
        help='Filter by category (optional)'
    )
    
    # Clear command
    clear_parser = subparsers.add_parser('clear', help='Clear cache keys')
    clear_parser.add_argument(
        'category',
        choices=['macro', 'crypto', 'lock', 'all'],
        help='Category to clear'
    )
    
    # Info command
    subparsers.add_parser('info', help='Show Redis information')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    # Execute command
    if args.command == 'list':
        list_keys(args.category)
    elif args.command == 'clear':
        clear_cache(args.category)
    elif args.command == 'info':
        show_info()


if __name__ == "__main__":
    main()
