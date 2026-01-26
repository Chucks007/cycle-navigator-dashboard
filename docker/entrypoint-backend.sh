#!/bin/bash
set -e

echo "=========================================="
echo "Backend container starting..."
echo "=========================================="

# Wait for dependencies (Redis and PostgreSQL)
echo "Waiting for dependencies..."
sleep 5

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
