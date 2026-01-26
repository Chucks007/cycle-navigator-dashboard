# Database Migrations with Alembic

This document explains the database migration system using Alembic for version control of database schemas.

## Overview

The project uses **Alembic** for database migrations, providing:

- **Version Control**: Track schema changes over time
- **Reproducibility**: Apply same changes across environments
- **Rollback Support**: Revert problematic changes
- **Auto-generation**: Detect model changes automatically
- **Team Collaboration**: Share schema changes via git

## Quick Start

### Initial Setup (Fresh Database)

```bash
# Run all migrations to create tables
python scripts/migrate.py upgrade

# Or use init_db.py which includes migrations
python scripts/init_db.py
```

### Existing Database (Already Has Tables)

If you have an existing database with tables already created manually:

```bash
# Mark database as up-to-date without running migrations
python scripts/migrate.py stamp
```

This tells Alembic that your database is already at the latest version.

## Common Operations

### Check Migration Status

```bash
# Quick status check
python scripts/migrate.py check

# Show current revision
python scripts/migrate.py current

# Show full migration history
python scripts/migrate.py history
```

### Apply Migrations

```bash
# Upgrade to latest version
python scripts/migrate.py upgrade

# Upgrade to specific revision
python scripts/migrate.py upgrade <revision_id>

# Or use Alembic directly
alembic upgrade head
```

### Create New Migration

```bash
# Auto-generate migration from model changes
python scripts/migrate.py create "Add new column to crypto_data"

# Create empty migration (manual)
python scripts/migrate.py create "Custom migration" --no-autogenerate

# Or use Alembic directly
alembic revision --autogenerate -m "Description"
```

### Rollback Migrations

```bash
# Downgrade one version
python scripts/migrate.py downgrade -1

# Downgrade to specific revision
python scripts/migrate.py downgrade <revision_id>

# Downgrade all (back to empty database)
python scripts/migrate.py downgrade base
```

⚠️ **Warning**: Downgrades can be destructive. Always backup data first!

## Migration Workflow

### 1. Modify Models

Edit `backend/models.py` to add/remove/modify tables or columns:

```python
# Example: Add a new column
class CryptoData(Base):
    # ... existing columns ...
    volume_24h = Column(Float)  # New column
```

### 2. Generate Migration

```bash
python scripts/migrate.py create "Add 24h volume to crypto data"
```

This creates a new migration file in `alembic/versions/`.

### 3. Review Migration

Open the generated file and review the changes:

```python
def upgrade() -> None:
    op.add_column('crypto_data', sa.Column('volume_24h', sa.Float()))

def downgrade() -> None:
    op.drop_column('crypto_data', 'volume_24h')
```

### 4. Apply Migration

```bash
python scripts/migrate.py upgrade
```

### 5. Commit to Git

```bash
git add alembic/versions/<new_migration>.py
git commit -m "Add 24h volume tracking to crypto data"
```

## Migration Files

### Location

Migrations are stored in: `alembic/versions/`

### Naming Convention

Format: `YYYYMMDD_HHMM_<revision>_<description>.py`

Example: `20260125_1944_7ff986bff217_initial_migration.py`

### Structure

```python
"""Migration description

Revision ID: 7ff986bff217
Revises: abc123def456  # Previous migration
Create Date: 2026-01-25 19:44:45.016597
"""

def upgrade() -> None:
    """Apply migration."""
    op.create_table(...)

def downgrade() -> None:
    """Revert migration."""
    op.drop_table(...)
```

## Configuration

### alembic.ini

Main configuration file in project root:

```ini
[alembic]
script_location = %(here)s/alembic
file_template = %%(year)d%%(month).2d%%(day).2d_%%(hour).2d%%(minute).2d_%%(rev)s_%%(slug)s
```

### alembic/env.py

Environment configuration:

- Imports models from `backend.models`
- Uses `DATABASE_URL` from environment
- Configures auto-generation

## Best Practices

### DO:

✅ **Review auto-generated migrations** before applying
- Alembic may not detect all changes correctly
- Verify data type conversions
- Check for missing constraints

✅ **Test migrations on development database first**
- Never run untested migrations in production
- Test both upgrade and downgrade paths

✅ **Write descriptive migration messages**
```bash
# Good
python scripts/migrate.py create "Add index on crypto_data.timestamp for query performance"

# Bad
python scripts/migrate.py create "Update table"
```

✅ **One logical change per migration**
- Makes rollbacks easier
- Easier to review and understand
- Better git history

✅ **Include data migrations when needed**
```python
def upgrade():
    # Schema change
    op.add_column('crypto_data', sa.Column('status', sa.String(20)))
    
    # Data migration
    op.execute("UPDATE crypto_data SET status = 'active' WHERE status IS NULL")
```

### DON'T:

❌ **Don't edit applied migrations**
- Creates inconsistencies across environments
- Create a new migration instead

❌ **Don't skip migrations**
- All environments should be on the same version
- Missing migrations cause issues

❌ **Don't commit migrations without testing**
- Always test upgrade and downgrade
- Verify data integrity after migration

❌ **Don't delete migration files**
- Needed for downgrade operations
- Part of version history

## Production Deployment

### Pre-Deployment Checklist

1. **Backup database**
   ```bash
   pg_dump cycle_navigator > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Test migration on staging**
   ```bash
   python scripts/migrate.py upgrade
   ```

3. **Review migration SQL**
   ```bash
   alembic upgrade head --sql > migration.sql
   # Review migration.sql
   ```

### Deployment Steps

```bash
# 1. Pull latest code
git pull origin main

# 2. Check migration status
python scripts/migrate.py current

# 3. Apply migrations
python scripts/migrate.py upgrade

# 4. Verify application health
curl http://localhost:8000/health/detailed

# 5. Restart application if needed
docker-compose restart backend
```

### Rollback Procedure

If migration causes issues:

```bash
# 1. Downgrade to previous version
python scripts/migrate.py downgrade -1

# 2. Restore from backup if needed
psql cycle_navigator < backup_20260125_194400.sql

# 3. Restart application
docker-compose restart backend
```

## Troubleshooting

### Migration Fails: "Table already exists"

Database has tables but Alembic doesn't know about them:

```bash
# Stamp database with current revision
python scripts/migrate.py stamp
```

### Migration Fails: "Column already exists"

Model and database are out of sync:

```bash
# 1. Check current state
python scripts/migrate.py current

# 2. Generate migration from current state
alembic revision --autogenerate -m "Sync database with models"

# 3. Review and apply
python scripts/migrate.py upgrade
```

### Can't Find Migration File

Migration file was deleted or not committed:

```bash
# Recreate from models
alembic revision --autogenerate -m "Recreate migration"
```

### Database Locked During Migration

Another process is using the database:

```bash
# Check for locks
SELECT * FROM pg_locks WHERE granted = false;

# Kill blocking queries
SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
WHERE datname = 'cycle_navigator' AND pid != pg_backend_pid();
```

## Integration with Init Scripts

### scripts/init_db.py

Now uses Alembic migrations:

```python
def init_database():
    """Create database tables using Alembic migrations."""
    from alembic import command
    from alembic.config import Config
    
    config = Config("alembic.ini")
    command.upgrade(config, "head")
```

Fallback to manual creation if Alembic not available.

### Docker Entrypoint

For automated deployments:

```bash
#!/bin/bash
# Wait for database
while ! pg_isready -h $DB_HOST -p $DB_PORT; do
  sleep 1
done

# Run migrations
python scripts/migrate.py upgrade

# Start application
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

## Advanced Usage

### Multiple Database Branches

For working on multiple features:

```bash
# Create branch migration
alembic revision -m "Feature X changes"

# Merge branches
alembic merge -m "Merge feature X" <rev1> <rev2>
```

### Offline Migration SQL

Generate SQL without database connection:

```bash
alembic upgrade head --sql > migration.sql
```

Useful for restricted production environments.

### Custom Migration Scripts

Manual migrations in `versions/` folder:

```python
def upgrade():
    # Complex data transformation
    conn = op.get_bind()
    result = conn.execute("SELECT id, data FROM old_table")
    
    for row in result:
        # Process and transform
        new_data = transform(row.data)
        conn.execute(
            "INSERT INTO new_table (id, processed_data) VALUES (%s, %s)",
            (row.id, new_data)
        )
```

## Related Documentation

- [DEVELOPER_SETUP.md](DEVELOPER_SETUP.md) - Development environment setup
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment
- [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) - System architecture
- [Alembic Documentation](https://alembic.sqlalchemy.org/) - Official docs
