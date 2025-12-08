#!/bin/bash

# Start FastAPI backend in the background
echo "Starting FastAPI backend..."
uvicorn backend.main:app --host 0.0.0.0 --port 8000 &

# Store the PID of the FastAPI process
FASTAPI_PID=$!

# Trap SIGTERM and SIGINT to gracefully shut down both processes
trap "echo 'Shutting down...' && kill $FASTAPI_PID && exit 0" SIGTERM SIGINT

# Start Streamlit frontend in the foreground
echo "Starting Streamlit frontend..."
streamlit run stock_dashboard.py --server.port 8501 --server.address 0.0.0.0

# Wait for background processes to finish (though Streamlit usually runs indefinitely)
wait $FASTAPI_PID