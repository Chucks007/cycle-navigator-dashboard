#!/bin/bash
set -e

echo "=========================================="
echo "Backend container starting..."
echo "=========================================="

# Wait for dependencies (Redis and PostgreSQL)
echo "Waiting for dependencies..."
sleep 5

# Initialize cache with data
echo "Initializing cache..."
python -m backend.init_cache || {
    echo "⚠ Cache initialization failed, but continuing..."
}

# Start the FastAPI server
echo "Starting FastAPI server..."
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000
