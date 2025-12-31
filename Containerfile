# Cycle Navigator Dashboard - Base Containerfile
# 
# NOTE: For production deployments, we recommend using docker-compose with
# the separate Dockerfiles in the docker/ directory. This provides better
# separation of concerns and allows independent scaling of services.
#
# See: docker-compose.yml, docker/backend.Dockerfile, docker/frontend.Dockerfile
#
# This Containerfile is retained for backward compatibility and simple
# single-container deployments where running both services together is acceptable.

FROM python:3.11-slim

WORKDIR /app

# Install curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose ports for FastAPI (8000) and Streamlit (8501)
EXPOSE 8000
EXPOSE 8501

# Default: run the backend. Override CMD to run frontend or use docker-compose.
# For single-container mode, you can override with a custom entrypoint script.
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
