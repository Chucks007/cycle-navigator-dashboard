#!/usr/bin/env python3
"""
Alembic database migration helper script.

Provides convenient commands for managing database migrations:
- Check migration status
- Upgrade to latest
- Downgrade
- Generate new migrations
"""

import argparse
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from alembic import command
from alembic.config import Config


def get_alembic_config():
    """Get Alembic configuration."""
    project_root = Path(__file__).parent.parent
    alembic_ini = project_root / "alembic.ini"
    
    if not alembic_ini.exists():
        print(f"❌ Alembic configuration not found: {alembic_ini}")
        sys.exit(1)
    
    return Config(str(alembic_ini))


def current():
    """Show current migration revision."""
    print("\n📊 Current Database Revision:\n")
    config = get_alembic_config()
    command.current(config, verbose=True)


def history():
    """Show migration history."""
    print("\n📜 Migration History:\n")
    config = get_alembic_config()
    command.history(config, verbose=True)


def upgrade(revision="head"):
    """
    Upgrade database to a specific revision.
    
    Args:
        revision: Target revision (default: 'head' for latest)
    """
    print(f"\n⬆️  Upgrading database to: {revision}\n")
    config = get_alembic_config()
    
    try:
        command.upgrade(config, revision)
        print("\n✅ Database upgrade completed successfully!")
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        sys.exit(1)


def downgrade(revision):
    """
    Downgrade database to a specific revision.
    
    Args:
        revision: Target revision (e.g., '-1' for previous, or specific revision ID)
    """
    print(f"\n⬇️  Downgrading database to: {revision}\n")
    config = get_alembic_config()
    
    # Confirm destructive operation
    response = input(f"⚠️  This will downgrade the database. Are you sure? (yes/no): ")
    if response.lower() != 'yes':
        print("Cancelled.")
        return
    
    try:
        command.downgrade(config, revision)
        print("\n✅ Database downgrade completed successfully!")
    except Exception as e:
        print(f"\n❌ Downgrade failed: {e}")
        sys.exit(1)


def create_migration(message, autogenerate=True):
    """
    Create a new migration.
    
    Args:
        message: Migration description
        autogenerate: Auto-detect changes from models
    """
    print(f"\n🆕 Creating new migration: {message}\n")
    config = get_alembic_config()
    
    try:
        if autogenerate:
            command.revision(config, message=message, autogenerate=True)
        else:
            command.revision(config, message=message)
        print("\n✅ Migration created successfully!")
    except Exception as e:
        print(f"\n❌ Migration creation failed: {e}")
        sys.exit(1)


def stamp(revision="head"):
    """
    Stamp database with a specific revision without running migrations.
    
    Useful for marking existing database as up-to-date.
    
    Args:
        revision: Revision to stamp (default: 'head')
    """
    print(f"\n📌 Stamping database as: {revision}\n")
    config = get_alembic_config()
    
    try:
        command.stamp(config, revision)
        print("\n✅ Database stamped successfully!")
    except Exception as e:
        print(f"\n❌ Stamp failed: {e}")
        sys.exit(1)


def check():
    """Check if database is up to date with migrations."""
    print("\n🔍 Checking migration status...\n")
    config = get_alembic_config()
    
    try:
        # Show current revision
        command.current(config, verbose=False)
        
        # Check for pending migrations
        # This is a simple check - in production you might want more sophisticated logic
        print("\n✅ Migration check completed!")
        print("\nTo see full history, run: python scripts/migrate.py history")
    except Exception as e:
        print(f"\n❌ Check failed: {e}")
        sys.exit(1)


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Manage Alembic database migrations",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Check current migration status
  python scripts/migrate.py check
  
  # Show migration history
  python scripts/migrate.py history
  
  # Upgrade to latest migration
  python scripts/migrate.py upgrade
  
  # Create new migration
  python scripts/migrate.py create "Add new table"
  
  # Downgrade one version
  python scripts/migrate.py downgrade -1
  
  # Stamp existing database (skip migrations)
  python scripts/migrate.py stamp
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    
    # Check command
    subparsers.add_parser('check', help='Check migration status')
    
    # Current command
    subparsers.add_parser('current', help='Show current revision')
    
    # History command
    subparsers.add_parser('history', help='Show migration history')
    
    # Upgrade command
    upgrade_parser = subparsers.add_parser('upgrade', help='Upgrade database')
    upgrade_parser.add_argument(
        'revision',
        nargs='?',
        default='head',
        help='Target revision (default: head)'
    )
    
    # Downgrade command
    downgrade_parser = subparsers.add_parser('downgrade', help='Downgrade database')
    downgrade_parser.add_argument(
        'revision',
        help='Target revision (e.g., -1 for previous)'
    )
    
    # Create migration command
    create_parser = subparsers.add_parser('create', help='Create new migration')
    create_parser.add_argument(
        'message',
        help='Migration description'
    )
    create_parser.add_argument(
        '--no-autogenerate',
        action='store_true',
        help='Create empty migration (no auto-detection)'
    )
    
    # Stamp command
    stamp_parser = subparsers.add_parser('stamp', help='Stamp database with revision')
    stamp_parser.add_argument(
        'revision',
        nargs='?',
        default='head',
        help='Revision to stamp (default: head)'
    )
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    # Execute command
    if args.command == 'check':
        check()
    elif args.command == 'current':
        current()
    elif args.command == 'history':
        history()
    elif args.command == 'upgrade':
        upgrade(args.revision)
    elif args.command == 'downgrade':
        downgrade(args.revision)
    elif args.command == 'create':
        create_migration(args.message, autogenerate=not args.no_autogenerate)
    elif args.command == 'stamp':
        stamp(args.revision)


if __name__ == "__main__":
    main()
