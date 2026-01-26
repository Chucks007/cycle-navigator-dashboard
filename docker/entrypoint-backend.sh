#!/bin/bash
set -e

echo "=========================================="
echo "Backend container starting..."
echo "=========================================="

# Wait for dependencies (Redis and PostgreSQL)
echo "Waiting for dependencies..."
sleep 5

# Auto-initialize database tables on startup
echo "Creating database tables..."
python -c "
from backend.models import Base
from sqlalchemy import create_engine
import os

db_url = os.environ.get('DATABASE_URL')
if not db_url:
    print('⚠ DATABASE_URL not set, skipping table creation')
    exit(0)

engine = create_engine(db_url)
Base.metadata.create_all(bind=engine)

from sqlalchemy import inspect
inspector = inspect(engine)
tables = inspector.get_table_names()
print(f'✓ Database ready: {len(tables)} tables')
for table in sorted(tables):
    print(f'  - {table}')
" || echo "⚠ Table creation failed, but continuing..."

# Check if we're running as a celery worker or beat scheduler
if [[ "$1" == "celery" ]]; then
    echo "Starting Celery: $@"
    exec "$@"
fi

# Initialize cache with data (only for the main backend)
echo "Initializing cache..."
python -m backend.init_cache || {
    echo "⚠ Cache initialization failed, but continuing..."
}

# Start the FastAPI server
echo "Starting FastAPI server..."
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000
